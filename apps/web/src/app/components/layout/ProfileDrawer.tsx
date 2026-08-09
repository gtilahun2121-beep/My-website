// ========================================================================
// USER PROFILE DRAWER COMPONENT
// Slide-out Drawer for Account, Wallet, and Support
// ========================================================================

'use client';

import React, { useState } from 'react';
import { User, Wallet, CreditScore } from '../../data';
import { translations } from '../../data';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  wallet: Wallet | null;
  creditScore: CreditScore | null;
  language: 'en' | 'am' | 'om' | 'ti';
  onLogout: () => void;
  onViewHistory: () => void;
  onRequestSupport: () => void;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  user,
  wallet,
  creditScore,
  language,
  onLogout,
  onViewHistory,
  onRequestSupport,
}) => {
  const [activeSection, setActiveSection] = useState<'account' | 'wallet' | 'trust' | 'support'>('account');

  const getTrustBadge = (tier: string) => {
    const badges: Record<string, string> = {
      standard: '⭐',
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      verified_trust: '✅',
    };
    return badges[tier] || '⭐';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed left-0 top-0 bottom-0 w-full max-w-sm bg-white z-50 shadow-lg overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-emerald-600 text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{translations.my_equbs[language]}</h2>
          <button onClick={onClose} className="text-2xl" aria-label="Close drawer">
            ✕
          </button>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-2xl">
                👤
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user.phone}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setActiveSection('account')}
            className={`w-full text-left px-4 py-3 ${
              activeSection === 'account' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-700'
            }`}
          >
            {translations.current_balance[language]}
          </button>
          <button
            onClick={() => setActiveSection('wallet')}
            className={`w-full text-left px-4 py-3 ${
              activeSection === 'wallet' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-700'
            }`}
          >
            {translations.linked_accounts[language]}
          </button>
          <button
            onClick={() => setActiveSection('trust')}
            className={`w-full text-left px-4 py-3 ${
              activeSection === 'trust' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-700'
            }`}
          >
            {translations.trust_score[language]}
          </button>
          <button
            onClick={() => setActiveSection('support')}
            className={`w-full text-left px-4 py-3 ${
              activeSection === 'support' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-700'
            }`}
          >
            Support
          </button>
        </div>

        {/* Content Sections */}
        <div className="p-4">
          {activeSection === 'account' && wallet && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">{translations.current_balance[language]}</h3>
              <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-1">Balance</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} {wallet.currency}
                </p>
              </div>
              <button
                onClick={onViewHistory}
                className="w-full bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
              >
                {translations.transaction_history[language]}
              </button>
            </div>
          )}

          {activeSection === 'wallet' && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">{translations.linked_accounts[language]}</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Telebirr</p>
                <p>• CBE Bank</p>
                <p>• Dashen Bank</p>
              </div>
              <button className="w-full mt-4 border border-emerald-600 text-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-50">
                Link New Account
              </button>
            </div>
          )}

          {activeSection === 'trust' && creditScore && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                {getTrustBadge(creditScore.tier)} {translations.trust_score[language]}
              </h3>
              <div className="bg-emerald-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">Score</p>
                <p className="text-2xl font-bold text-emerald-600">{creditScore.trustScore}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Tier: {creditScore.tier.charAt(0).toUpperCase() + creditScore.tier.slice(1)}
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  ✓ Successful Payments: <span className="font-semibold">{creditScore.successfulPaymentsCount}</span>
                </p>
                <p className="text-gray-600">
                  ⚠ Delayed Payments: <span className="font-semibold">{creditScore.delayedPaymentsCount}</span>
                </p>
              </div>
            </div>
          )}

          {activeSection === 'support' && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Support & Help</h3>
              <div className="space-y-2">
                <button className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm">
                  📖 {translations.faq_title[language]}
                </button>
                <button
                  onClick={onRequestSupport}
                  className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm"
                >
                  🎫 Submit Ticket
                </button>
                <button className="w-full text-left p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm">
                  📋 Terms & Privacy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 mt-auto">
          <button
            onClick={onLogout}
            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default ProfileDrawer;
