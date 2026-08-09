// ========================================================================
// EQUB POOL CARD COMPONENT
// Displays Equb Pool Information with Progress and Actions
// ========================================================================

'use client';

import React from 'react';
import { EqubPool } from '../../data';
import { translations } from '../../data';

interface EqubCardProps {
  equb: EqubPool;
  language: 'en' | 'am' | 'om' | 'ti';
  onViewDetails: (equbId: string) => void;
  onPayNow?: (equbId: string) => void;
  onPlaceBid?: (equbId: string) => void;
  variant?: 'active' | 'discover' | 'compact';
}

export const EqubCard: React.FC<EqubCardProps> = ({
  equb,
  language,
  onViewDetails,
  onPayNow,
  onPlaceBid,
  variant = 'active',
}) => {
  const getTierEmoji = (reputation: number) => {
    if (reputation >= 4.8) return '⭐⭐⭐⭐⭐';
    if (reputation >= 4.5) return '⭐⭐⭐⭐';
    if (reputation >= 4.0) return '⭐⭐⭐';
    return '⭐⭐';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-emerald-600 bg-emerald-50';
      case 'pending':
        return 'text-blue-600 bg-blue-50';
      case 'completed':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (variant === 'compact') {
    return (
      <div
        className="bg-white rounded-lg p-3 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onViewDetails(equb.id)}
      >
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-sm line-clamp-1">{equb.name}</h3>
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(equb.status)}`}>
            {equb.status}
          </span>
        </div>
        <p className="text-xs text-gray-600 mb-2">
          {equb.contributionSize.toLocaleString()} {translations.current_balance[language]}
        </p>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-emerald-600 h-2 rounded-full"
            style={{ width: `${equb.progressPercent}%` }}
            role="progressbar"
            aria-valuenow={equb.progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-lg font-bold">{equb.name}</h2>
            <p className="text-sm opacity-90">{equb.hostName}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(equb.status)}`}>
            {equb.status}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {/* Host Reputation */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <p className="text-sm text-gray-600 mb-1">Host Reputation</p>
          <p className="flex items-center gap-1">
            <span className="text-lg">{getTierEmoji(equb.hostReputation)}</span>
            <span className="font-semibold">{equb.hostReputation.toFixed(1)}</span>
          </p>
        </div>

        {/* Pool Details Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-600 mb-1">Contribution</p>
            <p className="font-semibold text-emerald-600">
              {equb.contributionSize.toLocaleString()} ETB
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Cycle</p>
            <p className="font-semibold">{equb.cycleFrequency}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Members</p>
            <p className="font-semibold">
              {equb.currentMembersCount}/{equb.totalCapacity}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-1">Round</p>
            <p className="font-semibold">
              {equb.currentRound}/{equb.totalRounds}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-600">{translations.active[language]}</span>
            <span className="text-xs font-semibold">{equb.progressPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all"
              style={{ width: `${equb.progressPercent}%` }}
              role="progressbar"
              aria-valuenow={equb.progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Payment Info */}
        {equb.unpaidRoundsCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">
              ⚠️ {equb.unpaidRoundsCount} {translations.unpaid_rounds[language]}
            </p>
            <p className="text-xs text-red-600 mt-1">
              Due: {equb.nextDeadline}
            </p>
          </div>
        )}

        {/* Deadline */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-600">{translations.next_deadline[language]}</p>
          <p className="text-sm font-semibold text-blue-700">{equb.nextDeadline}</p>
        </div>

        {/* Payout Mechanism */}
        <div className="mb-4 pb-4 border-b border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Payout Mechanism</p>
          <p className="font-semibold text-sm">
            {equb.payoutMechanism === 'auction' ? '🏆 Auction/Bidding' : '🎲 Lottery Draw'}
          </p>
          {equb.payoutMechanism === 'auction' && (
            <p className="text-xs text-gray-600 mt-1">Highest bidder wins, bid redistributed</p>
          )}
        </div>

        {/* Auto Debit Status */}
        {equb.autoDebitEnabled && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-emerald-700">
              ✅ {translations.auto_debit[language]} Enabled
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {equb.unpaidRoundsCount > 0 && onPayNow && (
            <button
              onClick={() => onPayNow(equb.id)}
              className="flex-1 bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              {translations.pay_now[language]}
            </button>
          )}
          {equb.payoutMechanism === 'auction' && onPlaceBid && (
            <button
              onClick={() => onPlaceBid(equb.id)}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {translations.place_bid[language]}
            </button>
          )}
          <button
            onClick={() => onViewDetails(equb.id)}
            className="flex-1 border border-emerald-600 text-emerald-600 px-4 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>

      {/* Social Proposals Badge */}
      {equb.socialProposals && equb.socialProposals.length > 0 && (
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            📋 {equb.socialProposals.length} Active Proposals
          </p>
        </div>
      )}
    </div>
  );
};

export default EqubCard;
