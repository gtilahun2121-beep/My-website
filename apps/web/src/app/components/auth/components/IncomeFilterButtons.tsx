'use client';

import { motion } from 'framer-motion';

interface IncomeFilterButtonsProps {
  selectedIncome: 'all' | 'low' | 'medium' | 'high';
  onSelect: (level: 'all' | 'low' | 'medium' | 'high') => void;
}

const filterOptions = [
  { value: 'all' as const, label: 'All', icon: '🌐', color: 'bg-[#001f3f]' },
  { value: 'low' as const, label: 'Low', icon: '📉', color: 'bg-yellow-500' },
  { value: 'medium' as const, label: 'Medium', icon: '📊', color: 'bg-brand-500' },
  { value: 'high' as const, label: 'High', icon: '📈', color: 'bg-brand-500' },
];

export default function IncomeFilterButtons({ selectedIncome, onSelect }: IncomeFilterButtonsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-[#f5f3f0] border-2 border-[#001f3f] rounded-lg p-4"
    >
      <p className="font-black text-[#00d9ff] mb-3">💵 Filter by Income Level</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {filterOptions.map((option) => (
          <motion.button
            key={option.value}
            onClick={() => onSelect(option.value)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`py-2 px-3 rounded-lg font-black text-xs transition-all ${
              selectedIncome === option.value
                ? `${option.color} text-[#00d9ff] shadow-lg`
                : 'bg-white border-2 border-[#001f3f] text-[#00d9ff]'
            }`}
          >
            <span className="block text-lg mb-1">{option.icon}</span>
            {option.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

