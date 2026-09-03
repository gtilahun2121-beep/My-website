'use client';

import React from 'react';
import { motion } from 'framer-motion';

export type EqubTierType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface EqubTierCardProps {
  tier: EqubTierType;
  isPopular?: boolean;
  onJoin?: (tier: EqubTierType) => void;
}

export default function EqubTierCard({
  tier,
  isPopular = false,
  onJoin,
}: EqubTierCardProps) {
  const tierData = {
    DAILY: {
      title: 'Daily Equb',
      icon: '📱',
      duration: '103 Days (~3.5 months)',
      contribution: '300 ETB',
      frequency: 'Every Day',
      members: '103',
      potSize: '30,900 ETB',
      targetUsers: 'Daily traders, informal vendors',
      features: [
        'Daily contributions',
        'Evening draw (5 PM)',
        'Quick liquidity',
        'Small daily amounts',
      ],
      color: 'from-brand-900 to-accent-600',
      lightColor: 'bg-brand-50',
      borderColor: 'border-brand-200',
      badge: 'Most Popular',
    },
    WEEKLY: {
      title: 'Weekly Equb',
      icon: '📊',
      duration: '12 Weeks (3 months)',
      contribution: '2,000 ETB',
      frequency: 'Every Week',
      members: '12',
      potSize: '24,000 ETB',
      targetUsers: 'Salaried workers, shop owners',
      features: [
        'Weekly contributions',
        'Weekly draw (Fridays)',
        'Balanced pace',
        'Moderate amounts',
      ],
      color: 'from-brand-900 to-accent-600',
      lightColor: 'bg-brand-50',
      borderColor: 'border-brand-200',
      badge: 'Best Balance',
    },
    MONTHLY: {
      title: 'Monthly Equb',
      icon: '🏦',
      duration: '6 Months',
      contribution: '10,000 ETB',
      frequency: 'Every Month',
      members: '6',
      potSize: '60,000 ETB',
      targetUsers: 'Mid-scale savings, large investments',
      features: [
        'Monthly contributions',
        'Monthly draw (30th)',
        'Larger capital',
        'Premium members',
      ],
      color: 'from-brand-900 to-accent-600',
      lightColor: 'bg-brand-50',
      borderColor: 'border-brand-200',
      badge: 'Premium',
    },
  };

  const data = tierData[tier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="h-full"
    >
      <div
        className={`relative h-full rounded-xl border-2 ${data.borderColor} ${data.lightColor} overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1`}
      >
        {/* Premium Badge */}
        {isPopular && (
          <div className={`absolute top-0 right-0 bg-gradient-to-r ${data.color} text-[#00d9ff] px-4 py-1 rounded-bl-lg text-sm font-bold`}>
            {data.badge}
          </div>
        )}

        {/* Header with Title */}
        <div className={`bg-gradient-to-r ${data.color} text-[#00d9ff] p-6`}>
          <h3 className="text-2xl font-black mb-2">{data.title}</h3>
          <p className="text-[#00d9ff]/90 text-sm font-semibold">{data.targetUsers}</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            {/* Duration */}
            <div>
              <p className="text-xs text-gray-600 font-semibold">Duration</p>
              <p className="text-sm font-bold text-[#00d9ff]">{data.duration}</p>
            </div>

            {/* Contribution */}
            <div>
              <p className="text-xs text-gray-600 font-semibold">Contribution</p>
              <p className="text-sm font-bold text-[#00d9ff]">{data.contribution}</p>
              <p className="text-xs text-gray-500">{data.frequency}</p>
            </div>

            {/* Members */}
            <div>
              <p className="text-xs text-gray-600 font-semibold">Members</p>
              <p className="text-sm font-bold text-[#00d9ff]">{data.members}</p>
            </div>

            {/* Pot Size */}
            <div>
              <p className="text-xs text-gray-600 font-semibold">Pot Size</p>
              <p className="text-sm font-bold text-[#00d9ff]">{data.potSize}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-200"></div>

          {/* Features */}
          <div>
            <p className="text-xs font-bold text-[#00d9ff] mb-3">What you get:</p>
            <ul className="space-y-2">
              {data.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-[#00d9ff]">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${data.color}`}></span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Join Button */}
          <button
            onClick={() => onJoin?.(tier)}
            className={`w-full py-3 px-4 bg-gradient-to-r ${data.color} text-[#00d9ff] font-bold rounded-lg hover:shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2`}
          >
            <span>Join {tier === 'DAILY' ? 'Daily' : tier === 'WEEKLY' ? 'Weekly' : 'Monthly'} Equb</span>
          </button>

          {/* Info Text */}
          <p className="text-xs text-gray-600 text-center">
            {tier === 'DAILY'
              ? 'Perfect for daily traders who need quick access to funds'
              : tier === 'WEEKLY'
              ? 'Ideal for salaried workers wanting steady growth'
              : 'For serious investors looking for larger capital'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
