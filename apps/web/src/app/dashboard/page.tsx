'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EqubGroup, Wallet, WalletTransaction, Notification } from '@qalnet/shared-types';
import { useAuth } from '@/app/context/AuthContext';
import api from '@/app/services/api';

interface DashboardData {
  equbs: EqubGroup[];
  wallet: Wallet | null;
  transactions: WalletTransaction[];
  notifications: Notification[];
  error: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

function LogoMark() {
  return (
    <div className="relative h-16 w-16 rounded-full bg-[conic-gradient(#1c9cd6_0deg_90deg,#ffd12a_90deg_180deg,#1dd3b0_180deg_270deg,#ff5d5d_270deg_360deg)] p-2 shadow-[0_8px_20px_rgba(0,0,0,0.14)]">
      <div className="flex h-full w-full items-center justify-center rounded-full bg-[#f5f5f2]">
        <div className="relative h-10 w-10 rounded-full border-[3px] border-[#0d2f2f]/80 bg-white/60">
          <div className="absolute inset-0 rounded-full border-[3px] border-[#0d2f2f]/60" />
          <div className="absolute inset-2 rounded-full border-[3px] border-[#0d2f2f]/50" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0d2f2f]" />
        </div>
      </div>
    </div>
  );
}

function JoinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#0a7f76]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="9" r="4" />
      <path d="M4 20c1.5-3 4-4 8-4s6.5 1 8 4" />
      <path d="M12 7v6m-3-3h6" />
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#f0c84e]" fill="currentColor">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="7" fill="white" />
      <circle cx="12" cy="12" r="5" fill="#f0c84e" opacity="0.3" />
    </svg>
  );
}

function WheelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#0d2f2f]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4M7.5 7.5l2.8 2.8M13.7 13.7l2.8 2.8M16.5 7.5l-2.8 2.8M10.3 13.7l-2.8 2.8" />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#0d2f2f]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M4 18c0-3 2-4 8-4s8 1 8 4" />
      <path d="M18 15c2 0 3 1 3 3v3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#0d2f2f]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M4 10h16M8 3v6M16 3v6" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#0d2f2f]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M3 12h18M7 16h2" />
    </svg>
  );
}

function InviteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#0d2f2f]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="9" r="3" />
      <path d="M4 18c0-2.5 2-3.5 5-3.5s5 1 5 3.5" />
      <path d="M18 10h4M20 8v4" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-12 w-12 text-[#b91c1c]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="currentColor">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2m0 3c3.9 0 7 3.1 7 7s-3.1 7-7 7-7-3.1-7-7 3.1-7 7-7" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MemberDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({
    equbs: [],
    wallet: null,
    transactions: [],
    notifications: [],
    error: null,
  });
  const [loading, setLoading] = useState(true);

  // Navigation handlers
  const handleMenuClick = (path: string) => {
    router.push(path);
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    const loadData = async () => {
      try {
        const [equbs, wallet, transactions, notifications] = await Promise.all([
          api.equbAPI.getAll().catch(() => []),
          api.walletAPI.getBalance().catch(() => null),
          api.walletAPI.getTransactions().catch(() => []),
          api.notificationsAPI.getNotifications().catch(() => []),
        ]);

        setData({
          equbs,
          wallet,
          transactions,
          notifications,
          error: null,
        });
      } catch (error) {
        setData((prev) => ({
          ...prev,
          error: 'Failed to load dashboard data',
        }));
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const formatETB = (amount: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Logo */}
      <div className="bg-white px-4 pt-6 pb-4 sm:px-6 sm:pt-8 sm:pb-6">
        <div className="flex items-center gap-3 sm:gap-4 mb-6">
          <LogoMark />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0d2f2f]">Digital Equb</h1>
            <p className="text-sm text-gray-600">Rotating Savings Circle</p>
          </div>
        </div>

        {/* Greeting */}
        <h2 className="text-xl sm:text-2xl font-semibold text-[#0d2f2f] mb-6">
          Good Morning, {user?.firstName || 'Member'}
        </h2>

        {/* Wallet Balance Card - Green */}
        <div className="relative bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white rounded-3xl p-6 sm:p-8 mb-6 overflow-hidden">
          {/* Decorative coins */}
          <div className="absolute top-4 right-6 sm:right-8 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-400 rounded-full opacity-70" />
            ))}
          </div>

          <div className="relative z-10">
            <p className="text-xs sm:text-sm font-bold opacity-90 mb-2">EQUB POT BALANCE</p>
            <h3 className="text-4xl sm:text-5xl font-bold mb-2">
              ETB {formatETB(data.wallet?.balance || 0)}
            </h3>
            <p className="text-sm sm:text-base opacity-90">Next winner payout: in 6 days</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          <button 
            onClick={() => handleMenuClick('/wallet')}
            className="bg-yellow-400 hover:bg-yellow-500 text-[#0d2f2f] font-bold py-3 sm:py-4 px-6 rounded-full transition-colors text-sm sm:text-base active:scale-95"
          >
            Contribute Now
          </button>
          <button 
            onClick={() => handleMenuClick('/my-equbs')}
            className="border-2 border-[#0a7f76] hover:bg-[#0a7f76]/5 text-[#0a7f76] font-bold py-3 sm:py-4 px-6 rounded-full transition-colors text-sm sm:text-base active:scale-95"
          >
            My Equbs
          </button>
        </div>
      </div>

      {/* Menu Grid - 2x3 */}
      <div className="px-4 pb-24 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          {/* Join Equb */}
          <div 
            onClick={() => handleMenuClick('/join-equb')}
            className="bg-white rounded-2xl p-5 sm:p-6 text-center hover:shadow-md transition-shadow cursor-pointer active:scale-95"
          >
            <div className="flex justify-center mb-3">
              <JoinIcon />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#0d2f2f]">Join Equb</p>
          </div>

          {/* Contribute */}
          <div 
            onClick={() => handleMenuClick('/wallet')}
            className="bg-white rounded-2xl p-5 sm:p-6 text-center hover:shadow-md transition-shadow cursor-pointer active:scale-95"
          >
            <div className="flex justify-center mb-3">
              <CoinIcon />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#0d2f2f]">Contribute</p>
          </div>

          {/* Winners Wheel */}
          <div 
            onClick={() => handleMenuClick('/my-equbs')}
            className="bg-white rounded-2xl p-5 sm:p-6 text-center hover:shadow-md transition-shadow cursor-pointer active:scale-95"
          >
            <div className="flex justify-center mb-3">
              <WheelIcon />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#0d2f2f]">Winners Wheel</p>
          </div>

          {/* Members */}
          <div 
            onClick={() => handleMenuClick('/my-equbs')}
            className="bg-white rounded-2xl p-5 sm:p-6 text-center hover:shadow-md transition-shadow cursor-pointer active:scale-95"
          >
            <div className="flex justify-center mb-3">
              <MembersIcon />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#0d2f2f]">Members</p>
          </div>

          {/* Schedule */}
          <div 
            onClick={() => handleMenuClick('/my-equbs')}
            className="bg-white rounded-2xl p-5 sm:p-6 text-center hover:shadow-md transition-shadow cursor-pointer active:scale-95"
          >
            <div className="flex justify-center mb-3">
              <CalendarIcon />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#0d2f2f]">Schedule</p>
          </div>

          {/* Payments */}
          <div 
            onClick={() => handleMenuClick('/wallet')}
            className="bg-white rounded-2xl p-5 sm:p-6 text-center hover:shadow-md transition-shadow cursor-pointer active:scale-95"
          >
            <div className="flex justify-center mb-3">
              <PaymentIcon />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#0d2f2f]">Payments</p>
          </div>

          {/* Invite Friends */}
          <div 
            onClick={() => handleMenuClick('/profile')}
            className="bg-white rounded-2xl p-5 sm:p-6 text-center hover:shadow-md transition-shadow cursor-pointer active:scale-95"
          >
            <div className="flex justify-center mb-3">
              <InviteIcon />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#0d2f2f]">Invite Friends</p>
          </div>

          {/* History */}
          <div 
            onClick={() => handleMenuClick('/wallet')}
            className="bg-white rounded-2xl p-5 sm:p-6 text-center hover:shadow-md transition-shadow cursor-pointer active:scale-95"
          >
            <div className="flex justify-center mb-3">
              <HistoryIcon />
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#0d2f2f]">History</p>
          </div>
        </div>

        {/* Spin Wheel Button - Red */}
        <div className="mb-6">
          <button 
            onClick={() => handleMenuClick('/my-equbs')}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 sm:py-5 px-6 rounded-full transition-colors flex items-center justify-center gap-3 text-sm sm:text-base active:scale-95"
          >
            <SpinIcon />
            Spin the Winner Wheel
          </button>
        </div>
      </div>

      {/* Bottom Navigation - Fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white px-4 py-3 sm:py-4 sm:px-6 flex justify-around items-center">
        <button 
          onClick={() => handleMenuClick('/my-equbs')}
          className="flex flex-col items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity active:scale-90"
        >
          <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="3" />
            <path d="M6 20c0-3 2.7-5 6-5s6 2 6 5" />
          </svg>
          <span>My Equb</span>
        </button>

        <button 
          onClick={() => handleMenuClick('/wallet')}
          className="flex flex-col items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity active:scale-90"
        >
          <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" fill="#f0c84e" />
            <circle cx="12" cy="12" r="7" fill="white" />
            <circle cx="12" cy="12" r="5" fill="#f0c84e" opacity="0.3" />
          </svg>
          <span>Contribute</span>
        </button>

        <button 
          onClick={() => handleMenuClick('/profile')}
          className="flex flex-col items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity active:scale-90"
        >
          <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="3" />
            <circle cx="18" cy="8" r="3" />
            <path d="M4 20c0-2.5 2-3.5 8-3.5s8 1 8 3.5" />
            <path d="M18 13c2 0 3 1 3 3v4" />
          </svg>
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
}
