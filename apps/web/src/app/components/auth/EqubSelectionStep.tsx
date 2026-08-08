'use client';

import { motion } from 'framer-motion';
import { equbCategories, EqubCategory } from '@/app/data/equbCategories';
import { useState } from 'react';

interface EqubSelectionStepProps {
  onSelect: (equb: EqubCategory) => void;
  selected?: EqubCategory | null;
}

export default function EqubSelectionStep({ onSelect, selected }: EqubSelectionStepProps) {
  const [search, setSearch] = useState('');

  const filteredEqubs = equbCategories.filter(
    (equb) =>
      equb.name.toLowerCase().includes(search.toLowerCase()) ||
      equb.profession.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-black text-[#0d7e4d] mb-2 text-center">
            🏢 Choose Your Equb Group
          </h3>
          <p className="text-center text-sm text-gray-600 mb-4">
            Select the profession-based Equb that matches your income level
          </p>
        </div>

        {/* Search */}
        <div>
          <input
            type="text"
            placeholder="Search profession or income level..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#0d7e4d] font-bold"
          />
        </div>

        {/* Equb List */}
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {filteredEqubs.map((equb) => (
            <motion.div
              key={equb.id}
              onClick={() => onSelect(equb)}
              whileHover={{ scale: 1.02 }}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selected?.id === equb.id
                  ? 'border-[#0d7e4d] bg-[#0d7e4d]/10'
                  : 'border-[#d4af37] bg-white hover:shadow-lg'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-3xl">{equb.icon}</span>
                <div className="flex-1">
                  <h4 className="font-black text-[#0d7e4d] text-sm">{equb.name}</h4>
                  <p className="text-xs text-gray-600 mb-2">{equb.description}</p>
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className="px-2 py-1 bg-[#0d7e4d]/10 text-[#0d7e4d] rounded font-bold">
                      ETB {equb.monthlyPayment}/mo
                    </span>
                    <span
                      className={`px-2 py-1 rounded font-bold ${
                        equb.incomeLevel === 'low'
                          ? 'bg-yellow-100 text-yellow-700'
                          : equb.incomeLevel === 'medium'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {equb.incomeLevel.charAt(0).toUpperCase() + equb.incomeLevel.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
