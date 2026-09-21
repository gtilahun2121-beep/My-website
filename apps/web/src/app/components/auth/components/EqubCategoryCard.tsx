'use client';

import { motion } from 'framer-motion';
import { EqubCategory } from '@/app/data/equbCategories';

interface EqubCategoryCardProps {
  equb: EqubCategory;
  onView: () => void;
}

export default function EqubCategoryCard({ equb, onView }: EqubCategoryCardProps) {
  const getIncomeBadgeColors = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-yellow-100 text-yellow-700';
      case 'medium':
        return 'bg-brand-100 text-brand-700';
      case 'high':
        return 'bg-brand-100 text-brand-700';
      default:
        return 'bg-gray-100 text-[#0066ff]';
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white border-2 border-[#0066ff] rounded-lg p-4 hover:shadow-lg transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-3xl">{equb.icon}</span>
          <div className="flex-1">
            <h4 className="font-black text-[#0066ff] text-sm">{equb.name}</h4>
            <p className="text-xs text-gray-600 mb-2">{equb.description}</p>
            <div className="flex gap-2 flex-wrap text-xs">
              <span className="px-2 py-1 bg-[#0066ff]/10 text-[#0066ff] rounded font-bold">
                ETB {equb.monthlyPayment}/mo
              </span>
              <span className="px-2 py-1 bg-[#0066ff]/30 text-[#0066ff] rounded font-bold">
                Return: ETB {equb.expectedReturn.toLocaleString()}
              </span>
              <span className="px-2 py-1 bg-brand-100 text-brand-700 rounded font-bold">
                {equb.members.toLocaleString()} members
              </span>
              <span className={`px-2 py-1 rounded font-bold ${getIncomeBadgeColors(equb.incomeLevel)}`}>
                {equb.incomeLevel.charAt(0).toUpperCase() + equb.incomeLevel.slice(1)} Income
              </span>
            </div>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onView}
          className="px-4 py-2 bg-[#0066ff] text-white font-black rounded-lg hover:shadow-md transition-all text-sm flex-shrink-0"
        >
          View
        </motion.button>
      </div>
    </motion.div>
  );
}

