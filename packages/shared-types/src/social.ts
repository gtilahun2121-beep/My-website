/**
 * Social / Governance shared types (proposals, voting).
 */

export interface CreateProposalRequest {
    title: string;
    description: string;
    equbId: string;
    options: string[];
}

export interface CastVoteRequest {
    proposalId: string;
    optionIndex: number;
}

export interface Proposal {
    id: string;
    title: string;
    description: string;
    equbId: string;
    options: ProposalOption[];
    status: 'open' | 'closed' | 'draft';
    createdBy: string;
    createdAt: string;
    closesAt?: string;
}

export interface ProposalOption {
    index: number;
    label: string;
    voteCount: number;
}
