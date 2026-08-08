'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface MemberDashboardProps {
  phoneNumber?: string;
  onSignOut?: () => void;
  onPaymentClick?: () => void;
}

export default function MemberDashboard({
  phoneNumber = '+251 9XX XXX XXXX',
  onSignOut,
  onPaymentClick,
}: MemberDashboardProps) {
  const [walletBalance] = useState(15450); // Example: ETB
  const [activeEqubs] = useState([
    {
      id: 'equb_1',
      name: 'Teachers Savings Group',
      memberCount: 12,
      monthlyContribution: 500,
      nextPayoutDate: '2026-08-15',
      position: 7,
      status: 'active',
      icon: '👨‍🏫',
    },
    {
      id: 'equb_2',
      name: 'Tech Freelancers Collective',
      memberCount: 8,
      monthlyContribution: 2000,
      nextPayoutDate: '2026-09-10',
      position: 3,
      status: 'active',
      icon: '💻',
    },
    {
      id: 'equb_3',
      name: 'Market Vendors Network',
      memberCount: 15,
      monthlyContribution: 300,
      nextPayoutDate: '2026-10-20',
      position: 5,
      status: 'pending_contribution',
      icon: '🛍️',
    },
  ]);

  const [pastPayouts] = useState([
    {
      id: 'payout_1',
      equbName: 'Tech Freelancers Collective',
      amount: 16000,
      date: '2026-06-10',
      icon: '✓',
    },
    {
      id: 'payout_2',
      equbName: 'Teachers Savings Group',
      amount: 6000,
      date: '2026-05-15',
      icon: '✓',
    },
  ]);

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
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] rounded-2xl p-6 text-white">
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
        className="bg-gradient-to-br from-[#ce1126] to-[#0d7e4d] rounded-2xl p-6 text-white shadow-lg"
      >
        <div className="mb-4">
          <p className="text-sm opacity-90 font-bold">Available Balance</p>
          <h3 className="text-4xl font-black">
            ETB {walletBalance.toLocaleString()}
          </h3>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onPaymentClick}
            className="flex-1 px-4 py-3 bg-[#d4af37] text-[#0d7e4d] font-black rounded-full hover:shadow-lg transition-all"
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
        <h3 className="font-black text-[#0d7e4d] text-lg mb-4 flex items-center gap-2">
          👥 Active Equbs ({activeEqubs.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeEqubs.map((equb, idx) => (
            <motion.div
              key={equb.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white border-2 border-[#d4af37] rounded-2xl p-4 hover:shadow-lg transition-all"
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

              <h4 className="font-black text-[#0d7e4d] mb-2 text-sm">{equb.name}</h4>

              <div className="space-y-2 text-xs text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Members:</span>
                  <span className="font-bold">{equb.memberCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly:</span>
                  <span className="font-bold text-[#0d7e4d]">
                    ETB {equb.monthlyContribution}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Your Position:</span>
                  <span className="font-bold text-[#ce1126]">#{equb.position}</span>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">Next Payout</p>
                <p className="font-black text-[#0d7e4d] text-sm">
                  {new Date(equb.nextPayoutDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-bold rounded-lg text-sm hover:shadow-md transition-all"
              >
                📋 View Details
              </motion.button>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={itemVariants}>
        <h3 className="font-black text-[#0d7e4d] text-lg mb-4">📊 Quick Stats</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border-2 border-blue-200">
            <p className="text-xs text-blue-600 font-bold mb-2">Total Active</p>
            <h4 className="text-3xl font-black text-blue-700">{activeEqubs.length}</h4>
            <p className="text-xs text-blue-600 mt-2">Equb Groups</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border-2 border-green-200">
            <p className="text-xs text-green-600 font-bold mb-2">Monthly Commitment</p>
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
          <h3 className="font-black text-[#0d7e4d] text-lg mb-4">✓ Past Payouts</h3>
          <div className="space-y-2">
            {pastPayouts.map((payout) => (
              <motion.div
                key={payout.id}
                whileHover={{ x: 4 }}
                className="bg-white border-l-4 border-green-500 rounded-lg p-4 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-black text-[#0d7e4d]">{payout.equbName}</p>
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
      {activeEqubs.length === 0 && (
        <motion.div
          variants={itemVariants}
          className="text-center py-12 bg-gray-50 rounded-2xl"
        >
          <p className="text-4xl mb-3">🌟</p>
          <h3 className="font-black text-[#0d7e4d] mb-2">No Active Equbs Yet</h3>
          <p className="text-sm text-gray-600 mb-4">
            Join your first Equb group to start saving with your community
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
