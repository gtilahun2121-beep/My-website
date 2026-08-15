'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '@/app/services/api';
import type { EqubGroup, WalletTransaction } from '@qalnet/shared-types';

interface MemberDashboardProps {
  phoneNumber?: string;
  onSignOut?: () => void;
  onPaymentClick?: () => void;
}

interface ActiveEqub {
  id: string;
  name: string;
  memberCount: number;
  monthlyContribution: number;
  totalPot: number;
  currentRound: number;
  totalRounds: number;
  status: string;
  icon: string;
}

interface PastPayout {
  id: string;
  equbName: string;
  amount: number;
  date: string;
  icon: string;
}

const ICONS = ['👨‍🏫', '💻', '🛍️', '👩‍🌾', '🏘️', '💼'];

export default function MemberDashboard({
  phoneNumber = '+251 9XX XXX XXXX',
  onSignOut,
  onPaymentClick,
}: MemberDashboardProps) {
  const [walletBalance, setWalletBalance] = useState(0);
  const [activeEqubs, setActiveEqubs] = useState<ActiveEqub[]>([]);
  const [pastPayouts, setPastPayouts] = useState<PastPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.walletAPI.getBalance().catch(() => ({ balance: 0 })),
      api.equbAPI.getMine().catch(() => [] as EqubGroup[]),
      api.walletAPI.getTransactions().catch(() => [] as WalletTransaction[]),
    ]).then(([walletRes, equbs, txns]) => {
      if (cancelled) return;

      setWalletBalance(walletRes.balance || 0);
      setActiveEqubs(
        equbs
          .filter((e) => e.status === 'open' || e.status === 'active')
          .map((e, idx) => ({
            id: e.id,
            name: e.name,
            memberCount: e.member_count,
            monthlyContribution: e.contribution_amount,
            totalPot: e.total_amount,
            currentRound: e.current_round,
            totalRounds: e.total_rounds,
            status: e.status === 'active' ? 'active' : 'pending',
            icon: ICONS[idx % ICONS.length],
          })),
      );
      setPastPayouts(
        txns
          .filter((t) => t.direction === 'payout')
          .map((t) => ({
            id: t.id,
            equbName: t.equb_name,
            amount: t.amount,
            date: new Date(t.created_at).toISOString().split('T')[0],
            icon: '✓',
          })),
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-[#314fa0] to-[#d4af37] rounded-2xl p-6 text-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-black mb-2">💼 Welcome Back!</h2>
            <p className="text-sm opacity-90">Phone: {phoneNumber}</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSignOut}
            className="px-4 py-2 bg-white/20 backdrop-blur text-white font-bold rounded-full hover:bg-white/30 transition-all text-sm"
          >
            🚪 Sign Out
          </motion.button>
        </div>
      </motion.div>

      {/* Wallet Card */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-br from-[#ce1126] to-[#314fa0] rounded-2xl p-6 text-white shadow-lg"
      >
        <div className="mb-4">
          <p className="text-sm opacity-90 font-bold">Available Balance</p>
          <h3 className="text-3xl sm:text-4xl font-black break-all">
            ETB {walletBalance.toLocaleString()}
          </h3>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPaymentClick}
            className="flex-1 px-4 py-3 bg-[#d4af37] text-[#314fa0] font-black rounded-full hover:shadow-lg transition-all"
          >
            💳 Make Payment
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-1 px-4 py-3 bg-white/20 backdrop-blur text-white font-bold rounded-full hover:bg-white/30 transition-all"
          >
            📊 Withdraw
          </motion.button>
        </div>
      </motion.div>

      {/* Active Equbs Section */}
      <motion.div variants={itemVariants}>
        <h3 className="font-black text-[#314fa0] text-lg mb-4 flex items-center gap-2">
          👥 Active Equbs ({activeEqubs.length})
        </h3>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading your Equbs...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeEqubs.map((equb, idx) => (
              <motion.div
                key={equb.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => router.push(`/equbs/${equb.id}`)}
                className="bg-white border-2 border-[#d4af37] rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-3xl">{equb.icon}</div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      equb.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {equb.status === 'active' ? '✓ Active' : '⏳ Pending'}
                  </span>
                </div>

                <h4 className="font-black text-[#314fa0] mb-2 text-sm">{equb.name}</h4>

                <div className="space-y-2 text-xs text-gray-600 mb-4">
                  <div className="flex justify-between">
                    <span>Members:</span>
                    <span className="font-bold">{equb.memberCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contribution:</span>
                    <span className="font-bold text-[#314fa0]">
                      ETB {equb.monthlyContribution}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Round:</span>
                    <span className="font-bold text-[#ce1126]">{equb.currentRound} / {equb.totalRounds}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1">Total Pot</p>
                  <p className="font-black text-[#314fa0] text-sm">
                    ETB {equb.totalPot.toLocaleString()}
                  </p>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(`/equbs/${equb.id}`)}
                  className="w-full py-2 bg-gradient-to-r from-[#314fa0] to-[#d4af37] text-white font-bold rounded-lg text-sm hover:shadow-md transition-all"
                >
                  📋 View Details
                </motion.button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants}>
        <h3 className="font-black text-[#314fa0] text-lg mb-4">📊 Quick Stats</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border-2 border-blue-200">
            <p className="text-xs text-blue-600 font-bold mb-2">Total Active</p>
            <h4 className="text-3xl font-black text-blue-700">{activeEqubs.length}</h4>
            <p className="text-xs text-blue-600 mt-2">Equb Groups</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border-2 border-green-200">
            <p className="text-xs text-green-600 font-bold mb-2">Contribution Commitment</p>
            <h4 className="text-3xl font-black text-green-700">
              ETB {activeEqubs.reduce((sum, e) => sum + e.monthlyContribution, 0)}
            </h4>
            <p className="text-xs text-green-600 mt-2">Total Contribution</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 border-2 border-purple-200">
            <p className="text-xs text-purple-600 font-bold mb-2">Received Payouts</p>
            <h4 className="text-3xl font-black text-purple-700">{pastPayouts.length}</h4>
            <p className="text-xs text-purple-600 mt-2">Successfully</p>
          </div>
        </div>
      </motion.div>

      {/* Past Payouts */}
      {pastPayouts.length > 0 && (
        <motion.div variants={itemVariants}>
          <h3 className="font-black text-[#314fa0] text-lg mb-4">✓ Past Payouts</h3>
          <div className="space-y-2">
            {pastPayouts.map((payout) => (
              <motion.div
                key={payout.id}
                whileHover={{ x: 4 }}
                className="bg-white border-l-4 border-green-500 rounded-lg p-4 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-[#314fa0]">{payout.equbName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(payout.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <p className="font-black text-green-600 text-lg">
                    ETB {payout.amount.toLocaleString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Empty State Message */}
      {!loading && activeEqubs.length === 0 && (
        <motion.div
          variants={itemVariants}
          className="text-center py-12 bg-gray-50 rounded-2xl"
        >
          <p className="text-4xl mb-3">🌟</p>
          <h3 className="font-black text-[#314fa0] mb-2">No Active Equbs Yet</h3>
          <p className="text-sm text-gray-600 mb-4">
            Join your first Equb group to start saving with your community
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
