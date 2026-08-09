/**
 * social.service.ts
 *
 * Core business logic for the social module:
 *
 *  - createProposal()        — members submit social fund spending proposals
 *  - listProposals()         — list proposals for an equb group
 *  - castVote()              — democratic vote (yes/no), quorum enforcement
 *  - executeProposal()       — Admin executes approved proposal, deducts fund
 *  - fileReconciliationTicket() — members file payment disputes
 *  - flagCrb()               — Admin flags a defaulter on CRB
 *  - releaseCrb()            — Admin releases a CRB flag
 */

import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';

import { SocialRepository, VoteTally } from './social.repository';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { RlsContext, getPool } from '../../config/database.config';

@Injectable()
export class SocialService {
    private readonly logger = new Logger(SocialService.name);

    constructor(private readonly repo: SocialRepository) { }

    // ── Create Proposal ──────────────────────────────────────────────────────

    /**
     * POST /api/v1/equbs/:id/proposals
     *
     * Any active member of the equb can submit a social fund proposal.
     * After creation, all members receive a notification.
     */
    async createProposal(
        equbId: string,
        dto: CreateProposalDto,
        ctx: RlsContext,
    ): Promise<{ proposal_id: string; message: string }> {

        // Validate budget doesn't exceed current social fund balance
        const balance = await this.repo.getSocialFundBalance(equbId);
        if (dto.budget > balance) {
            throw new BadRequestException(
                `Requested budget (${dto.budget} ETB) exceeds the social fund balance (${balance} ETB).`,
            );
        }

        const proposal = await this.repo.createProposal(
            equbId,
            ctx.userId,
            dto.title,
            dto.description,
            dto.budget,
            ctx,
        );

        // Notify all equb members about the new proposal
        await this.repo.notifyAllMembers(
            equbId,
            'social_trust',
            `New Proposal: ${dto.title}`,
            `A new social fund proposal has been submitted. Budget: ${dto.budget} ETB. ` +
            `Log in to review and vote.`,
            'telegram,push',
        );

        this.logger.log(`Proposal created: ${proposal.id} by user ${ctx.userId}`);

        return {
            proposal_id: proposal.id,
            message: 'Proposal submitted. All members have been notified to vote.',
        };
    }

    // ── List Proposals ───────────────────────────────────────────────────────

    async listProposals(equbId: string, status?: string) {
        return this.repo.listProposalsByEqub(equbId, status);
    }

    // ── Cast Vote ────────────────────────────────────────────────────────────

    /**
     * POST /api/v1/proposals/:id/vote
     *
     * Each member can vote once. After every vote we re-tally
     * and auto-resolve the proposal if quorum + majority is met.
     *
     * Quorum  = > 50% of group members have voted
     * Approved = quorum met AND approve_count > reject_count
     */
    async castVote(
        proposalId: string,
        dto: CastVoteDto,
        ctx: RlsContext,
    ): Promise<VoteTally & { status_updated: boolean; new_status?: string }> {

        // Verify proposal exists and is still open
        const proposal = await this.repo.findProposalById(proposalId);
        if (!proposal) throw new NotFoundException('Proposal not found.');

        if (proposal.status !== 'open') {
            throw new ConflictException(
                `This proposal is already ${proposal.status}. Voting is closed.`,
            );
        }

        // Check for double-vote (also enforced at DB level via UNIQUE constraint)
        const alreadyVoted = await this.repo.hasVoted(proposalId, ctx.userId);
        if (alreadyVoted) {
            throw new ConflictException('You have already cast your vote on this proposal.');
        }

        // Cast the vote
        await this.repo.castVote(proposalId, ctx.userId, dto.vote, ctx);

        // Re-tally after this vote
        const tally = await this.repo.tallyVotes(proposalId);

        let statusUpdated = false;
        let newStatus: string | undefined;

        // Auto-resolve if quorum is met
        if (tally.quorum_met) {
            newStatus = tally.approved ? 'in_progress' : 'rejected';
            statusUpdated = true;

            await this.repo.updateProposalStatus(
                proposalId,
                newStatus as any,
                ctx,
            );

            // Notify members of the outcome
            await this.repo.notifyAllMembers(
                proposal.equb_id,
                'social_trust',
                tally.approved
                    ? `Proposal Approved: ${proposal.title}`
                    : `Proposal Rejected: ${proposal.title}`,
                tally.approved
                    ? `The proposal "${proposal.title}" has been approved with ${tally.approve_count} votes. ` +
                    `An admin will execute the fund disbursement shortly.`
                    : `The proposal "${proposal.title}" was rejected with ${tally.reject_count} votes against.`,
                'telegram,push',
            );

            this.logger.log(
                `Proposal ${proposalId} auto-resolved to "${newStatus}" after quorum reached.`,
            );
        }

        return { ...tally, status_updated: statusUpdated, new_status: newStatus };
    }

    // ── Execute Proposal (Admin only) ────────────────────────────────────────

    /**
     * PATCH /api/v1/proposals/:id/execute
     *
     * Admin executes an approved proposal:
     *  1. Validates status is 'in_progress' (quorum approved)
     *  2. Deducts budget from social_fund_balance
     *  3. Marks proposal as 'resolved'
     *  4. Notifies all members
     */
    async executeProposal(
        proposalId: string,
        ctx: RlsContext,
    ): Promise<{ success: boolean; message: string }> {

        if (ctx.userRole !== 'admin') {
            throw new ForbiddenException('Only admins can execute approved proposals.');
        }

        const proposal = await this.repo.findProposalById(proposalId);
        if (!proposal) throw new NotFoundException('Proposal not found.');

        if (proposal.status !== 'in_progress') {
            throw new ConflictException(
                `Proposal must be in "in_progress" status to execute. Current: ${proposal.status}`,
            );
        }

        // Deduct from social fund — fails if balance is insufficient
        const deducted = await this.repo.deductSocialFund(
            proposal.equb_id,
            proposal.budget,
            ctx,
        );

        if (!deducted) {
            throw new BadRequestException(
                `Insufficient social fund balance to disburse ${proposal.budget} ETB.`,
            );
        }

        // Mark resolved
        await this.repo.updateProposalStatus(proposalId, 'resolved', ctx);

        // Notify members
        await this.repo.notifyAllMembers(
            proposal.equb_id,
            'social_trust',
            `Funds Disbursed: ${proposal.title}`,
            `${proposal.budget} ETB has been disbursed from the social fund for "${proposal.title}".`,
            'telegram,sms,push',
        );

        this.logger.log(
            `Proposal ${proposalId} executed by admin ${ctx.userId}. Disbursed: ${proposal.budget} ETB`,
        );

        return {
            success: true,
            message: `${proposal.budget} ETB disbursed successfully from social fund.`,
        };
    }

    // ── Reconciliation Ticket ─────────────────────────────────────────────────

    /**
     * POST /api/v1/tickets
     *
     * Member files a payment dispute / reconciliation ticket.
     */
    async fileTicket(
        transactionReference: string,
        reportedAmount: number,
        paymentId: string | undefined,
        ctx: RlsContext,
    ): Promise<{ ticket_id: string; message: string }> {

        const ticket = await this.repo.createReconciliationTicket(
            {
                user_id: ctx.userId,
                payment_id: paymentId,
                transaction_reference: transactionReference,
                reported_amount: reportedAmount,
            },
            ctx,
        );

        // Notify admin of new ticket via system_policy channel
        const adminRows = await getPool() <{ id: string }[]>`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `;

        if (adminRows[0]) {
            await this.repo.dispatchNotification({
                user_id: adminRows[0].id,
                category: 'system_policy',
                title: 'New Reconciliation Ticket',
                body: `User ${ctx.userId} filed a ticket for tx_ref: ${transactionReference}, amount: ${reportedAmount} ETB.`,
                delivered_channels: 'telegram,push',
            });
        }

        return {
            ticket_id: ticket.id,
            message: 'Ticket filed. An admin will review it shortly.',
        };
    }

    async listMyTickets(ctx: RlsContext) {
        return this.repo.listTicketsByUser(ctx.userId);
    }

    // ── CRB Flag (Admin only) ─────────────────────────────────────────────────

    async flagCrb(
        targetUserId: string,
        reason: string,
        ctx: RlsContext,
    ): Promise<{ message: string }> {

        if (ctx.userRole !== 'admin') {
            throw new ForbiddenException('Only admins can flag users on CRB.');
        }

        await this.repo.flagUserCrb(targetUserId, reason, ctx);

        // Notify the flagged user
        await this.repo.dispatchNotification({
            user_id: targetUserId,
            category: 'system_policy',
            title: 'Account Flagged on CRB',
            body: 'Your account has been reported to the Credit Reference Bureau due to payment defaults. Contact support immediately.',
            delivered_channels: 'telegram,sms',
        });

        this.logger.warn(`CRB flag set for user ${targetUserId} by admin ${ctx.userId}`);

        return { message: `User ${targetUserId} has been flagged on CRB.` };
    }

    async releaseCrb(
        targetUserId: string,
        ctx: RlsContext,
    ): Promise<{ message: string }> {

        if (ctx.userRole !== 'admin') {
            throw new ForbiddenException('Only admins can release CRB flags.');
        }

        await this.repo.releaseCrbFlag(targetUserId, ctx);

        await this.repo.dispatchNotification({
            user_id: targetUserId,
            category: 'system_policy',
            title: 'CRB Flag Released',
            body: 'Your CRB flag has been released. Your account is now in good standing.',
            delivered_channels: 'telegram,sms',
        });

        return { message: `CRB flag released for user ${targetUserId}.` };
    }
}
