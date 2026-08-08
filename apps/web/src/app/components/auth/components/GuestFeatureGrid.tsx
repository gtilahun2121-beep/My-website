'use client';

import { motion } from 'framer-motion';
import { getTotalMembers } from '@/app/data/equbCategories';

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

export default function GuestFeatureGrid() {
  return (
    <div className="space-y-3">
      {features.map((feature, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
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
  );
}
