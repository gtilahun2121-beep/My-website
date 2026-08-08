'use client';

import { motion } from 'framer-motion';
import { EqubCategory } from '@/app/data/equbCategories';

interface EqubDetailModalProps {
  equb: EqubCategory;
  onClose: () => void;
  onJoin: () => void;
}

export default function EqubDetailModal({ equb, onClose, onJoin }: EqubDetailModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-96 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-start gap-4">
            <span className="text-5xl">{equb.icon}</span>
            <div>
              <h2 className="text-2xl font-black text-[#0d7e4d]">{equb.name}</h2>
              <p className="text-sm text-gray-600">{equb.profession}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400">
            ✕
          </button>
        </div>

        {/* Key Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0d7e4d]/10 rounded-lg p-4">
            <p className="text-xs text-gray-600 mb-1">Monthly Payment</p>
            <p className="text-2xl font-black text-[#0d7e4d]">ETB {equb.monthlyPayment.toLocaleString()}</p>
          </div>
          <div className="bg-[#d4af37]/20 rounded-lg p-4">
            <p className="text-xs text-gray-600 mb-1">Expected Return</p>
            <p className="text-2xl font-black text-[#d4af37]">ETB {equb.expectedReturn.toLocaleString()}</p>
          </div>
          <div className="bg-blue-100 rounded-lg p-4">
            <p className="text-xs text-gray-600 mb-1">Active Members</p>
            <p className="text-2xl font-black text-blue-700">{equb.members.toLocaleString()}</p>
          </div>
          <div className={`rounded-lg p-4 ${
            equb.incomeLevel === 'low' ? 'bg-yellow-100' :
            equb.incomeLevel === 'medium' ? 'bg-blue-100' :
            'bg-green-100'
          }`}>
            <p className="text-xs text-gray-600 mb-1">Income Level</p>
            <p className={`text-2xl font-black ${
              equb.incomeLevel === 'low' ? 'text-yellow-700' :
              equb.incomeLevel === 'medium' ? 'text-blue-700' :
              'text-green-700'
            }`}>
              {equb.incomeLevel.charAt(0).toUpperCase() + equb.incomeLevel.slice(1)}
            </p>
          </div>
        </div>

        {/* About */}
        <div className="mb-6">
          <h3 className="font-black text-[#0d7e4d] mb-2">📝 About This Group</h3>
          <p className="text-sm text-gray-600">{equb.description}</p>
        </div>

        {/* Payment Cycle */}
        <div className="bg-[#f5f3f0] border-2 border-[#d4af37] rounded-lg p-4 mb-6">
          <h3 className="font-black text-[#0d7e4d] mb-2">📅 Payment Cycle</h3>
          <p className="text-lg font-black text-[#ce1126] mb-1">{equb.paymentCycle.duration} Months</p>
          <p className="text-sm text-gray-600">{equb.paymentCycle.description}</p>
        </div>

        {/* Payment Methods */}
        <div className="mb-6">
          <h3 className="font-black text-[#0d7e4d] mb-3">💳 Accepted Payment Methods</h3>
          <div className="space-y-2">
            {equb.paymentMethods.map((method, idx) => (
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

        {/* Benefits */}
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

        {/* Actions */}
        <div className="space-y-3">
          <motion.button
            onClick={onJoin}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all"
          >
            ✍️ Join This Equb
          </motion.button>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-2 border-2 border-[#0d7e4d] text-[#0d7e4d] font-black rounded-full hover:bg-[#0d7e4d]/10 transition-all"
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
