// ========================================================================
// AUCTION PANEL COMPONENT
// Mounted on the Equb detail page. Lets members place discount bids for the
// current round, shows the live leaderboard, and lets hosts/admins resolve
// the auction — the highest bidder wins the pot minus their bid.
// ========================================================================

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import api from '@/app/services/api';
import { useAuth } from '@/app/context/AuthContext';
import type {
  BidRecord,
  AuctionResolutionResponse,
} from '@qalnet/shared-types';

interface AuctionPanelProps {
  equbId: string;
  roundNumber: number;
  potValue: number;
  isHost: boolean;
  isAdmin: boolean;
  isActive: boolean;
  isMember: boolean;
  /** Called after a bid/resolution so the parent can refresh round/status. */
  onChange?: () => void;
}

export const AuctionPanel: React.FC<AuctionPanelProps> = ({
  equbId,
  roundNumber,
  potValue,
  isHost,
  isAdmin,
  isActive,
  isMember,
  onChange,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.id;
  const canResolve = (isHost || isAdmin) && isActive;

  const [bids, setBids] = useState<BidRecord[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [result, setResult] = useState<AuctionResolutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadBids = useCallback(async () => {
    try {
      const data = await api.paymentsAPI.listRoundBids(equbId, roundNumber);
      setBids(data.items);
    } catch {
      setError('Could not load the auction leaderboard.');
    }
  }, [equbId, roundNumber]);

  useEffect(() => {
    let cancelled = false;
    api.paymentsAPI
      .listRoundBids(equbId, roundNumber)
      .then((data) => {
        if (!cancelled) setBids(data.items);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the auction leaderboard.');
      });
    return () => {
      cancelled = true;
    };
  }, [equbId, roundNumber]);

  const handleSubmitBid = async () => {
    setError(null);
    setNotice(null);
    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a bid amount greater than zero.');
      return;
    }
    if (amount >= potValue) {
      setError(`Bids must be less than the pot (ETB ${potValue.toLocaleString()}).`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.paymentsAPI.submitBid(equbId, amount);
      setNotice(res.message);
      setBidAmount('');
      await loadBids();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place your bid.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async () => {
    setError(null);
    setNotice(null);
    setResolving(true);
    try {
      const res = await api.paymentsAPI.resolveAuction(equbId);
      setResult(res);
      setNotice(res.message);
      await loadBids();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve the auction.');
    } finally {
      setResolving(false);
    }
  };

  const winning = bids.find((b) => b.status === 'winning');

  return (
    <div className="bg-white rounded-xl shadow-md p-6 sm:p-8 mt-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-xl font-black text-[#0066ff] mb-1">
            🏆 {isHost || isAdmin ? 'Auction / Bidding' : 'Round Auction'}
          </h2>
          <p className="text-sm text-gray-500">
            Highest bidder wins the Round {roundNumber} pot minus their bid.
          </p>
        </div>

        {canResolve && (
          <button
            onClick={handleResolve}
            disabled={resolving}
            className={`px-5 py-2.5 rounded-lg font-black text-[#0066ff] transition-all ${
              resolving
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-[#0066ff] hover:bg-[#0047b3]'
            }`}
          >
            {resolving ? 'Resolving…' : '🏁 Resolve Auction'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-brand-50 border border-brand-200 text-brand-700 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {notice && (
        <div className="bg-brand-50 border border-brand-300 text-[#0042ad] rounded-lg p-4 mb-6 text-sm">
          {notice}
        </div>
      )}

      {result && (
        <div className="bg-brand-50 border border-brand-200 text-[#0042ad] rounded-lg p-5 mb-6">
          <p className="font-black text-lg mb-1">
            🎉 {result.winner.first_name} {result.winner.last_name} won Round {result.round_number}
          </p>
          <ul className="text-sm space-y-1 mt-2">
            <li>
              Winning bid: <strong>ETB {Number(result.bid_amount).toLocaleString()}</strong>
            </li>
            <li>
              Payout: <strong>ETB {Number(result.payout_amount).toLocaleString()}</strong>
            </li>
            <li>
              Redistributed share: <strong>ETB {Number(result.redistributed_share).toLocaleString()}</strong> to each
              remaining member
            </li>
            <li>Total bids: <strong>{result.total_bids}</strong></li>
          </ul>
        </div>
      )}

      {/* Bid placement */}
      {isMember && isActive && !winning && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-6">
          <input
            type="number"
            min={1}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            placeholder={`Bid amount in ETB (pot: ${potValue.toLocaleString()})`}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066ff]"
          />
          <button
            onClick={handleSubmitBid}
            disabled={submitting}
            className={`px-5 py-3 rounded-lg font-black text-[#0066ff] transition-all ${
              submitting
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-[#0066ff] hover:bg-[#0066ff]'
            }`}
          >
            {submitting ? 'Placing…' : '📈 Place Bid'}
          </button>
        </div>
      )}

      {/* Leaderboard */}
      {bids.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-[#0066ff] text-gray-500 uppercase tracking-wide mb-3">
            Leaderboard — Round {roundNumber}
          </h3>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {bids.map((b) => {
              const mine = b.user_id === currentUserId;
              return (
                <li
                  key={b.id}
                  className={`flex items-center justify-between px-4 py-3 text-sm ${
                    b.status === 'winning' ? 'bg-brand-50' : 'bg-gray-50'
                  } ${mine ? 'ring-1 ring-[#0066ff]' : ''}`}
                >
                  <span className="font-bold text-[#0066ff]">
                    {mine ? '⭐ ' : ''}
                    {b.first_name} {b.last_name}
                    {b.status === 'winning' && ' 🏆'}
                  </span>
                  <span className="text-[#0066ff]">
                    ETB {Number(b.bid_amount).toLocaleString()}
                    <span className="text-gray-400 text-xs ml-2">
                      → {Number(b.potential_payout).toLocaleString()} payout
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!bids.length && (
        <p className="text-center text-gray-400 text-sm mt-4">
          No bids have been placed for Round {roundNumber} yet.
        </p>
      )}
    </div>
  );
};
