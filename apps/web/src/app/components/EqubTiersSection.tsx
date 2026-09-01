'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import EqubTierCard, { EqubTierType } from './EqubTierCard';
import EqubJoinModal from './modals/EqubJoinModal';

interface EqubTiersSectionProps {
  onJoinStart?: () => void;
  isAuthenticated?: boolean;
}

export default function EqubTiersSection({
  onJoinStart,
  isAuthenticated = false,
}: EqubTiersSectionProps) {
  const [selectedTier, setSelectedTier] = useState<EqubTierType | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleJoinClick = (tier: EqubTierType) => {
    if (!isAuthenticated) {
      onJoinStart?.();
      return;
    }
    setSelectedTier(tier);
    setShowJoinModal(true);
  };

  const handleCloseModal = () => {
    setShowJoinModal(false);
    setSelectedTier(null);
  };

  const stats = [
    { label: 'Active Equbs', value: '1,234+', icon: '📊' },
    { label: 'Total Members', value: '45,678+', icon: '👥' },
    { label: 'Payouts Processed', value: '89,234 ETB', icon: '💰' },
    { label: 'Success Rate', value: '99.8%', icon: '✅' },
  ];

  return (
    <div className="py-16 px-4 bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-16">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
            Choose Your Equb Tier
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Three flexible options designed for different financial goals. Start with as little as
            300 ETB per day or invest in a larger monthly equb.
          </p>
        </motion.div>
      </div>

      {/* Tier Cards */}
      <div className="max-w-6xl mx-auto mb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <EqubTierCard
            tier="DAILY"
            isPopular={true}
            onJoin={handleJoinClick}
          />
          <EqubTierCard
            tier="WEEKLY"
            onJoin={handleJoinClick}
          />
          <EqubTierCard
            tier="MONTHLY"
            onJoin={handleJoinClick}
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-6xl mx-auto mb-16">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="bg-white rounded-xl shadow-lg p-8 md:p-12"
        >
          <h3 className="text-3xl font-black text-gray-900 mb-12 text-center">
            Trusted by Thousands
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-4xl mb-2">{stat.icon}</div>
                <p className="text-3xl font-black text-blue-600 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-600 font-semibold">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Comparison Table */}
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h3 className="text-3xl font-black text-gray-900 mb-8 text-center">
            Detailed Comparison
          </h3>

          <div className="overflow-x-auto bg-white rounded-xl shadow-lg">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-bold">Feature</th>
                  <th className="px-6 py-4 text-center font-bold">Daily</th>
                  <th className="px-6 py-4 text-center font-bold">Weekly</th>
                  <th className="px-6 py-4 text-center font-bold">Monthly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { feature: 'Duration', daily: '103 days', weekly: '12 weeks', monthly: '6 months' },
                  { feature: 'Contribution', daily: '300 ETB/day', weekly: '2,000 ETB/week', monthly: '10,000 ETB/month' },
                  { feature: 'Total Members', daily: '103', weekly: '12', monthly: '6' },
                  { feature: 'Pot Size', daily: '30,900 ETB', weekly: '24,000 ETB', monthly: '60,000 ETB' },
                  { feature: 'Draw Frequency', daily: 'Daily @ 5 PM', weekly: 'Weekly', monthly: 'Monthly' },
                  { feature: 'Platform Fee', daily: '3.5%', weekly: '3.5%', monthly: '2.9%' },
                  { feature: 'Grace Period', daily: '3 days', weekly: '2 days', monthly: '5 days' },
                  { feature: 'Late Fee', daily: '5%', weekly: '4%', monthly: '3%' },
                  { feature: 'Guarantor Required', daily: '✅ Yes', weekly: '✅ Yes', monthly: '❌ No' },
                ].map((row, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900">{row.feature}</td>
                    <td className="px-6 py-4 text-center text-gray-700">{row.daily}</td>
                    <td className="px-6 py-4 text-center text-gray-700">{row.weekly}</td>
                    <td className="px-6 py-4 text-center text-gray-700">{row.monthly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        className="max-w-4xl mx-auto mt-20 text-center"
      >
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl p-8 md:p-12 text-white">
          <h3 className="text-3xl md:text-4xl font-black mb-4">
            Ready to Start Your Equb Journey?
          </h3>
          <p className="text-lg text-white/90 mb-8">
            Join thousands of Ethiopians saving together. Choose your tier and start today!
          </p>
          <button
            onClick={() => {
              if (!isAuthenticated) {
                onJoinStart?.();
              } else {
                setSelectedTier('DAILY');
                setShowJoinModal(true);
              }
            }}
            className="bg-white text-blue-600 px-8 py-4 font-bold rounded-lg hover:shadow-xl transition-all hover:scale-105 inline-flex items-center gap-2"
          >
            <span>🚀 Get Started Now</span>
          </button>
        </div>
      </motion.div>

      {/* Join Modal */}
      {selectedTier && (
        <EqubJoinModal
          isOpen={showJoinModal}
          onClose={handleCloseModal}
          tierType={selectedTier}
        />
      )}
    </div>
  );
}
