/**
 * user-lottery.dto.ts
 *
 * User-facing (member) lottery view models. These are READ-ONLY responses
 * returned by the user lottery endpoints and intentionally expose ONLY
 * public fields.
 *
 * SECURITY: never include phone, email, wallet balance, addresses, internal
 * auth data, or raw database ids in these shapes. Winner identity is reduced
 * to a single `displayName` (first name + last-name initial), and all
 * eligibility values are computed on the BACKEND from database state — the
 * frontend merely renders what the server returns.
 */

/** A public winner identity — only the display name is exposed. */
export interface PublicWinner {
    /** e.g. "Dawit A." — first name + last-name initial. */
    displayName: string;
}

/** One public lottery history row (a completed, public draw). */
export interface UserLotteryHistoryItem {
    /** Which cycle/round this win belonged to, e.g. 12. */
    cycle: number;
    winner: PublicWinner;
    /** ISO timestamp of when the draw was committed. */
    drawnAt: string;
}

/** Response from GET /api/v1/equbs/:id/lottery/current */
export interface UserLotteryCurrentResponse {
    cycle: {
        /** Current active cycle number. */
        number: number;
        total_rounds: number;
        status: 'open' | 'active' | 'completed' | 'cancelled';
        started_at: string;
        updated_at: string;
        is_active: boolean;
    };
    eligibility: {
        /** Whether the user's contribution for the current cycle is paid. */
        contribution: 'paid' | 'unpaid';
        /** True only when approved + paid + not already won (backend-computed). */
        eligible: boolean;
        /** True once the user has won during the current cycle. */
        won: boolean;
        /** Human-readable status the UI can surface verbatim. */
        message: string;
    };
    /** The most recent public win, or null if none drawn yet. */
    latestWinner: UserLotteryHistoryItem | null;
}

/** Response from GET /api/v1/equbs/:id/lottery/history */
export interface UserLotteryHistoryResponse {
    items: UserLotteryHistoryItem[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}
