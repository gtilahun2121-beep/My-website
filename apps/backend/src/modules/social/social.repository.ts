/**
 * social.repository.ts
 *
 * All database reads/writes for the social module:
 *  - Social fund proposals (create, list, status update)
 *  - Democratic votes (cast, tally)
 *  - Social fund balance management
 *  - Notifications dispatch log
 *  - Reconciliation ticket management
 *  - CRB blacklist flagging (Admin only)
 */

import { Injectable, Logger } from '@nestjs/common';
import { getPool, inTransaction, RlsContext } from '../../config/database.config';

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface ProposalRecord {
    id: string;
    equb_id: string;
    proposer_id: string;
    title: string;
    description: string;
    budget: number;
    status: 'open' | 'in_progress' | 'resolved' | 'rejected';
    created_at: Date;
}

export interface VoteTally {
    proposal_id: string;
    approve_count: number;
    reject_count: number;
    total_votes: number;
    total_members: number;
    quorum_met: boolean;  // true if > 50% of members voted
    approved: boolean;  // true if approve_count > reject_count AND quorum met
}

export interface NotificationInput {
    user_id: string;
    category: 'operational' | 'social_trust' | 'system_policy';
    title: string;
    body: string;
    delivered_channels: string;
}

export interface ReconciliationTicketInput {
    user_id: string;
    payment_id?: string;
    transaction_reference: string;
    reported_amount: number;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

@Injectable()
export class SocialRepository {
    private readonly logger = new Logger(SocialRepository.name);

    // ── Proposals ──────────────────────────────────────────────────────────────

    async createProposal(
        equbId: string,
        proposerId: string,
        title: string,
        description: string,
        budget: number,
        ctx: RlsContext,
    ): Promise<ProposalRecord> {
        return inTransaction(ctx, async (tx) => {
            const [proposal] = await tx<ProposalRecord[]>`
        INSERT INTO social_proposals
          (equb_id, proposer_id, title, description, budget)
        VALUES
          (${equbId}, ${proposerId}, ${title}, ${description}, ${budget})
        RETURNING *
      `;
            return proposal;
        });
    }

    async listProposalsByEqub(
        equbId: string,
        status?: string,
    ): Promise<ProposalRecord[]> {
        const sql = getPool();

        if (status) {
            return sql<ProposalRecord[]>`
        SELECT * FROM social_proposals
        WHERE equb_id = ${equbId}
          AND status  = ${status}
        ORDER BY created_at DESC
        LIMIT 100
      `;
        }

        return sql<ProposalRecord[]>`
      SELECT * FROM social_proposals
      WHERE equb_id = ${equbId}
      ORDER BY created_at DESC
      LIMIT 100
    `;
    }

    async findProposalById(proposalId: string): Promise<ProposalRecord | null> {
        const sql = getPool();

        const rows = await sql<ProposalRecord[]>`
      SELECT * FROM social_proposals
      WHERE id = ${proposalId}
      LIMIT 1
    `;

        return rows[0] ?? null;
    }

    async updateProposalStatus(
        proposalId: string,
        status: ProposalRecord['status'],
        ctx: RlsContext,
    ): Promise<void> {
        return inTransaction(ctx, async (tx) => {
            await tx`
        UPDATE social_proposals
        SET status = ${status}
        WHERE id = ${proposalId}
      `;
        });
    }

    // ── Votes ──────────────────────────────────────────────────────────────────

    /**
     * Casts a vote. UNIQUE(proposal_id, user_id) in DB prevents duplicates.
     * Returns false if the member already voted (ON CONFLICT DO NOTHING).
     */
    async castVote(
        proposalId: string,
        userId: string,
        vote: boolean,
        ctx: RlsContext,
    ): Promise<boolean> {
        return inTransaction(ctx, async (tx) => {
            const result = await tx<{ id: string }[]>`
        INSERT INTO social_votes (proposal_id, user_id, vote_value)
        VALUES (${proposalId}, ${userId}::uuid, ${vote})
        ON CONFLICT (proposal_id, user_id) DO NOTHING
        RETURNING id
      `;
            return result.length > 0;
        });
    }

    /**
     * Tallies all votes for a proposal and determines if quorum is met.
     * Quorum = more than 50% of equb members have voted.
     * Approved = quorum met AND approve_count > reject_count.
     */
    async tallyVotes(proposalId: string): Promise<VoteTally> {
        const sql = getPool();

        // Get vote counts
        const [tally] = await sql<{
            approve_count: string;
            reject_count: string;
        }[]>`
      SELECT
        COUNT(*) FILTER (WHERE vote_value = TRUE)  AS approve_count,
        COUNT(*) FILTER (WHERE vote_value = FALSE) AS reject_count
      FROM social_votes
      WHERE proposal_id = ${proposalId}
    `;

        const approveCount = parseInt(tally?.approve_count ?? '0', 10);
        const rejectCount = parseInt(tally?.reject_count ?? '0', 10);
        const totalVotes = approveCount + rejectCount;

        // Get total members in the equb group
        const [proposal] = await sql<{ equb_id: string }[]>`
      SELECT equb_id FROM social_proposals WHERE id = ${proposalId}
    `;

        const [memberCount] = await sql<{ count: string }[]>`
      SELECT COUNT(*) AS count
      FROM memberships
      WHERE equb_id = ${proposal?.equb_id}
    `;

        const totalMembers = parseInt(memberCount?.count ?? '0', 10);
        const quorumMet = totalMembers > 0 && totalVotes > totalMembers / 2;
        const approved = quorumMet && approveCount > rejectCount;

        return {
            proposal_id: proposalId,
            approve_count: approveCount,
            reject_count: rejectCount,
            total_votes: totalVotes,
            total_members: totalMembers,
            quorum_met: quorumMet,
            approved,
        };
    }

    /**
     * Checks if a user has already voted on a proposal.
     */
    async hasVoted(proposalId: string, userId: string): Promise<boolean> {
        const sql = getPool();

        const rows = await sql<{ id: string }[]>`
      SELECT id FROM social_votes
      WHERE proposal_id = ${proposalId}
        AND user_id     = ${userId}::uuid
      LIMIT 1
    `;

        return rows.length > 0;
    }

    // ── Social Fund Balance ────────────────────────────────────────────────────

    /**
     * Deducts budget from the equb's social_fund_balance when a
     * proposal is approved and executed.
     * Returns false if balance is insufficient.
     */
    async deductSocialFund(
        equbId: string,
        amount: number,
        ctx: RlsContext,
    ): Promise<boolean> {
        return inTransaction(ctx, async (tx) => {
            const result = await tx<{ id: string }[]>`
        UPDATE equb_groups
        SET social_fund_balance = social_fund_balance - ${amount},
            updated_at          = NOW()
        WHERE id                    = ${equbId}
          AND social_fund_balance  >= ${amount}
        RETURNING id
      `;
            return result.length > 0;
        });
    }

    async getSocialFundBalance(equbId: string): Promise<number> {
        const sql = getPool();

        const [row] = await sql<{ social_fund_balance: number }[]>`
      SELECT social_fund_balance
      FROM equb_groups
      WHERE id = ${equbId}
    `;

        return row?.social_fund_balance ?? 0;
    }

    // ── Notifications ──────────────────────────────────────────────────────────

    /**
     * Dispatches a notification record to the notifications table.
     * Actual delivery (Telegram, SMS, Push) happens via a separate
     * notification worker that polls this table.
     */
    async dispatchNotification(input: NotificationInput): Promise<void> {
        const sql = getPool();

        await sql`
      INSERT INTO notifications
        (user_id, category, title, body, delivered_channels)
      VALUES
        (
          ${input.user_id}::uuid,
          ${input.category},
          ${input.title},
          ${input.body},
          ${input.delivered_channels}
        )
    `;
    }

    /**
     * Bulk-dispatches notifications to all members of an equb group.
     * Used for proposal creation / vote result announcements.
     */
    async notifyAllMembers(
        equbId: string,
        category: NotificationInput['category'],
        title: string,
        body: string,
        channels: string,
    ): Promise<void> {
        const sql = getPool();

        // Resolve all member user_ids for the equb
        const members = await sql<{ user_id: string }[]>`
      SELECT user_id FROM memberships WHERE equb_id = ${equbId}
    `;

        if (members.length === 0) return;

        // Bulk insert notifications in one statement
        const values = members.map((m) => ({
            user_id: m.user_id,
            category,
            title,
            body,
            delivered_channels: channels,
        }));

        await sql`
      INSERT INTO notifications
        ${sql(values, 'user_id', 'category', 'title', 'body', 'delivered_channels')}
    `;
    }

    // ── Reconciliation Tickets ─────────────────────────────────────────────────

    async createReconciliationTicket(
        input: ReconciliationTicketInput,
        ctx: RlsContext,
    ): Promise<{ id: string }> {
        return inTransaction(ctx, async (tx) => {
            const [ticket] = await tx<{ id: string }[]>`
        INSERT INTO reconciliation_tickets
          (user_id, payment_id, transaction_reference, reported_amount)
        VALUES
          (
            ${input.user_id}::uuid,
            ${input.payment_id ?? null},
            ${input.transaction_reference},
            ${input.reported_amount}
          )
        RETURNING id
      `;
            return ticket;
        });
    }

    async listTicketsByUser(userId: string): Promise<any[]> {
        const sql = getPool();

        return sql`
      SELECT id, transaction_reference, reported_amount, status,
             notes, resolved_at, created_at
      FROM reconciliation_tickets
      WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC
    `;
    }

    // ── CRB Blacklist (Admin only) ─────────────────────────────────────────────

    async flagUserCrb(
        userId: string,
        reason: string,
        ctx: RlsContext,
    ): Promise<void> {
        return inTransaction(ctx, async (tx) => {
            await tx`
        INSERT INTO crb_blacklists (user_id, reason)
        VALUES (${userId}::uuid, ${reason})
        ON CONFLICT (user_id)
        DO UPDATE SET
          reason      = EXCLUDED.reason,
          reported_at = NOW(),
          is_released = FALSE,
          released_at = NULL
      `;
        });
    }

    async releaseCrbFlag(userId: string, ctx: RlsContext): Promise<void> {
        return inTransaction(ctx, async (tx) => {
            await tx`
        UPDATE crb_blacklists
        SET is_released = TRUE,
            released_at = NOW()
        WHERE user_id = ${userId}::uuid
      `;
        });
    }

    async isCrbFlagged(userId: string): Promise<boolean> {
        const sql = getPool();

        const rows = await sql<{ id: string }[]>`
      SELECT id FROM crb_blacklists
      WHERE user_id    = ${userId}::uuid
        AND is_released = FALSE
      LIMIT 1
    `;

        return rows.length > 0;
    }
}
