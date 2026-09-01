/**
 * lottery.dto.ts
 *
 * Lottery draw request/response shapes for the Equb lottery spinning
 * mechanism (spec §4 — CSPRNG-driven draws with on-chain-style audit).
 *
 * The draw itself is non-deterministic and transparent: the backend picks
 * the winner using Node's crypto CSPRNG from the eligible member set, and
 * returns both the winner AND the full candidate list so the client can
 * animate a fair spinning wheel that lands on the winning segment.
 */

/** A single eligible lottery participant (approved member who paid the round). */
export interface LotteryCandidate {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
}

/** Response from POST /api/v1/equbs/:id/draws */
export interface LotteryDrawResponse {
    draw: {
        id: string;
        equb_id: string;
        round_number: number;
        winner_id: string;
        draw_timestamp: string;
    };
    winner: LotteryCandidate;
    candidates: LotteryCandidate[];
    /** Human-readable status the UI can surface verbatim. */
    message: string;
}

/** Response from GET /api/v1/equbs/:id/draws */
export interface LotteryDrawListResponse {
    items: {
        id: string;
        round_number: number;
        winner_id: string;
        draw_timestamp: string;
        winner_first_name: string;
        winner_last_name: string;
        winner_phone: string;
    }[];
    total: number;
    current_round: number;
    total_rounds: number;
}