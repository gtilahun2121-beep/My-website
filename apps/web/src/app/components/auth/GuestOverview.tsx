'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { equbCategories, getEqubByIncomeLevel, getTotalMembers, EqubCategory } from '@/app/data/equbCategories';
import { useState } from 'react';

interface GuestOverviewProps {
  lang: Language;
}

export default function GuestOverview({ lang }: GuestOverviewProps) {
  const t = translations[lang];
  const [selectedIncome, setSelectedIncome] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [selectedEqub, setSelectedEqub] = useState<EqubCategory | null>(null);
  const [showModal, setShowModal] = useState(false);

  const displayedEqubs = selectedIncome === 'all' 
    ? equbCategories 
    : getEqubByIncomeLevel(selectedIncome as 'low' | 'medium' | 'high');

  const features = [
    {
      icon: '💰',
      title: 'Equb Savings',
      description: 'Join profession-based savings groups matched to your income level',
    },
    {
      icon: '👥',
      title: 'Community',
      description: `Connect with ${getTotalMembers().toLocaleString()}+ members in your profession`,
    },
    {
      icon: '🔒',
      title: 'Secure',
      description: 'Your money and data are protected with advanced encryption',
    },
    {
      icon: '⚡',
      title: 'Fast Payouts',
      description: 'Quick and reliable payout processing when your turn comes',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <>
      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Welcome Card */}
        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] rounded-2xl p-6 text-white"
        >
          <h2 className="text-2xl font-black mb-3">👋 Welcome to QalNet!</h2>
          <p className="text-sm leading-relaxed">
            Discover profession-based Equb groups designed for your income level. Save together, grow together.
          </p>
        </motion.div>

        {/* Key Features */}
        <div className="space-y-3">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              className="bg-white border-2 border-[#d4af37] rounded-lg p-4 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{feature.icon}</span>
                <div>
                  <h3 className="font-black text-[#0d7e4d]">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Income Level Filter */}
        <motion.div
          variants={itemVariants}
          className="bg-[#f5f3f0] border-2 border-[#d4af37] rounded-lg p-4"
        >
          <p className="font-black text-[#0d7e4d] mb-3">💵 Filter by Income Level</p>
          <div className="grid grid-cols-4 gap-2">
            <motion.button
              onClick={() => setSelectedIncome('all')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`py-2 px-3 rounded-lg font-black text-xs transition-all ${
                selectedIncome === 'all'
                  ? 'bg-[#0d7e4d] text-white'
                  : 'bg-white border-2 border-[#0d7e4d] text-[#0d7e4d]'
              }`}
            >
              All
            </motion.button>
            <motion.button
              onClick={() => setSelectedIncome('low')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`py-2 px-3 rounded-lg font-black text-xs transition-all ${
                selectedIncome === 'low'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white border-2 border-yellow-500 text-yellow-600'
              }`}
            >
              Low
            </motion.button>
            <motion.button
              onClick={() => setSelectedIncome('medium')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`py-2 px-3 rounded-lg font-black text-xs transition-all ${
                selectedIncome === 'medium'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border-2 border-blue-500 text-blue-600'
              }`}
            >
              Medium
            </motion.button>
            <motion.button
              onClick={() => setSelectedIncome('high')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`py-2 px-3 rounded-lg font-black text-xs transition-all ${
                selectedIncome === 'high'
                  ? 'bg-green-500 text-white'
                  : 'bg-white border-2 border-green-500 text-green-600'
              }`}
            >
              High
            </motion.button>
          </div>
        </motion.div>

        {/* Equb Categories */}
        <motion.div
          variants={itemVariants}
          className="space-y-3"
        >
          <h3 className="font-black text-[#0d7e4d] text-lg">🏢 Available Equb Groups ({displayedEqubs.length})</h3>
          <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
            {displayedEqubs.map((equb) => (
              <motion.div
                key={equb.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white border-2 border-[#d4af37] rounded-lg p-4 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-3xl">{equb.icon}</span>
                    <div className="flex-1">
                      <h4 className="font-black text-[#0d7e4d] text-sm">{equb.name}</h4>
                      <p className="text-xs text-gray-600 mb-2">{equb.description}</p>
                      <div className="flex gap-2 flex-wrap text-xs">
                        <span className="px-2 py-1 bg-[#0d7e4d]/10 text-[#0d7e4d] rounded font-bold">
                          ETB {equb.monthlyPayment}/mo
                        </span>
                        <span className="px-2 py-1 bg-[#d4af37]/30 text-[#0d7e4d] rounded font-bold">
                          Return: ETB {equb.expectedReturn.toLocaleString()}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-bold">
                          {equb.members.toLocaleString()} members
                        </span>
                        <span className={`px-2 py-1 rounded font-bold ${
                          equb.incomeLevel === 'low' ? 'bg-yellow-100 text-yellow-700' :
                          equb.incomeLevel === 'medium' ? 'bg-blue-100 text-blue-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {equb.incomeLevel.charAt(0).toUpperCase() + equb.incomeLevel.slice(1)} Income
                        </span>
                      </div>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedEqub(equb);
                      setShowModal(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-lg hover:shadow-md transition-all text-sm flex-shrink-0"
                  >
                    View
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-3 gap-3"
        >
          <div className="bg-[#0d7e4d] text-white rounded-lg p-4 text-center">
            <div className="text-2xl font-black">{equbCategories.length}</div>
            <div className="text-xs">Categories</div>
          </div>
          <div className="bg-[#d4af37] text-[#0d7e4d] rounded-lg p-4 text-center">
            <div className="text-2xl font-black">{getTotalMembers().toLocaleString()}+</div>
            <div className="text-xs">Total Members</div>
          </div>
          <div className="bg-[#ce1126] text-white rounded-lg p-4 text-center">
            <div className="text-2xl font-black">99%</div>
            <div className="text-xs">On-Time Payouts</div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          variants={itemVariants}
          className="space-y-3"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const signUpTab = document.querySelector('button:nth-of-type(2)') as HTMLButtonElement;
              signUpTab?.click();
            }}
            className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300"
          >
            🚀 Start Your Equb Journey
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Modal */}
      {showModal && selectedEqub && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-start gap-4">
                <span className="text-5xl">{selectedEqub.icon}</span>
                <div>
                  <h2 className="text-2xl font-black text-[#0d7e4d]">{selectedEqub.name}</h2>
                  <p className="text-sm text-gray-600">{selectedEqub.profession}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-2xl text-gray-400">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[#0d7e4d]/10 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Monthly Payment</p>
                <p className="text-2xl font-black text-[#0d7e4d]">ETB {selectedEqub.monthlyPayment.toLocaleString()}</p>
              </div>
              <div className="bg-[#d4af37]/20 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Expected Return</p>
                <p className="text-2xl font-black text-[#d4af37]">ETB {selectedEqub.expectedReturn.toLocaleString()}</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-1">Active Members</p>
                <p className="text-2xl font-black text-blue-700">{selectedEqub.members.toLocaleString()}</p>
              </div>
              <div className={`rounded-lg p-4 ${
                selectedEqub.incomeLevel === 'low' ? 'bg-yellow-100' :
                selectedEqub.incomeLevel === 'medium' ? 'bg-blue-100' :
                'bg-green-100'
              }`}>
                <p className="text-xs text-gray-600 mb-1">Income Level</p>
                <p className={`text-2xl font-black ${
                  selectedEqub.incomeLevel === 'low' ? 'text-yellow-700' :
                  selectedEqub.incomeLevel === 'medium' ? 'text-blue-700' :
                  'text-green-700'
                }`}>
                  {selectedEqub.incomeLevel.charAt(0).toUpperCase() + selectedEqub.incomeLevel.slice(1)}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-black text-[#0d7e4d] mb-2">📝 About This Group</h3>
              <p className="text-sm text-gray-600">{selectedEqub.description}</p>
            </div>

            <div className="bg-[#f5f3f0] border-2 border-[#d4af37] rounded-lg p-4 mb-6">
              <h3 className="font-black text-[#0d7e4d] mb-2">⏰ Payout Frequency</h3>
              <p className="text-sm font-bold text-[#d4af37]">{selectedEqub.payoutFrequency}</p>
            </div>

            <div className="bg-[#f5f3f0] border-2 border-[#d4af37] rounded-lg p-4 mb-6">
              <h3 className="font-black text-[#0d7e4d] mb-2">📅 Payment Cycle</h3>
              <p className="text-lg font-black text-[#ce1126] mb-1">{selectedEqub.paymentCycle.duration} Months</p>
              <p className="text-sm text-gray-600">{selectedEqub.paymentCycle.description}</p>
            </div>

            <div className="mb-6">
              <h3 className="font-black text-[#0d7e4d] mb-3">💳 Accepted Payment Methods</h3>
              <div className="space-y-2">
                {selectedEqub.paymentMethods.map((method, idx) => (
                  <div key={idx} className="bg-white border-2 border-[#d4af37] rounded-lg p-3 flex items-start gap-3">
                    <span className="text-2xl">{method.icon}</span>
                    <div>
                      <p className="font-black text-[#0d7e4d] text-sm">{method.name}</p>
                      <p className="text-xs text-gray-600">{method.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-black text-[#0d7e4d] mb-3">✨ Benefits</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="text-[#0d7e4d] font-black">✓</span>
                  <span>Safe and secure savings with peers in your profession</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#0d7e4d] font-black">✓</span>
                  <span>Fair payment amounts matched to your income level</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#0d7e4d] font-black">✓</span>
                  <span>Support from colleagues who understand your work</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[#0d7e4d] font-black">✓</span>
                  <span>Guaranteed payout when your turn comes</span>
                </li>
              </ul>
            </div>

            <motion.button
              onClick={() => {
                setShowModal(false);
                localStorage.setItem('selectedEqubId', selectedEqub.id);
                const signUpTab = document.querySelector('button:nth-of-type(2)') as HTMLButtonElement;
                signUpTab?.click();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all mb-3"
            >
              ✍️ Join This Equb
            </motion.button>

            <motion.button
              onClick={() => setShowModal(false)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-2 border-2 border-[#0d7e4d] text-[#0d7e4d] font-black rounded-full hover:bg-[#0d7e4d]/10 transition-all"
            >
              Close
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
