'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { EqubTierType } from '../EqubTierCard';

interface EqubJoinModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierType: EqubTierType;
}

export default function EqubJoinModal({
  isOpen,
  onClose,
  tierType,
}: EqubJoinModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<'confirm' | 'joining' | 'success'>('confirm');
  const [error, setError] = useState('');

  const tierInfo = {
    DAILY: {
      title: '📱 Daily Equb',
      contribution: '300 ETB/day',
      duration: '103 days (~3.5 months)',
      potSize: '30,900 ETB',
      color: 'blue',
    },
    WEEKLY: {
      title: '📊 Weekly Equb',
      contribution: '2,000 ETB/week',
      duration: '12 weeks (3 months)',
      potSize: '24,000 ETB',
      color: 'amber',
    },
    MONTHLY: {
      title: '🏦 Monthly Equb',
      contribution: '10,000 ETB/month',
      duration: '6 months',
      potSize: '60,000 ETB',
      color: 'green',
    },
  };

  const info = tierInfo[tierType];
  const colorMap = {
    blue: { bg: 'bg-brand-50', border: 'border-brand-200', text: 'text-brand-600', button: 'bg-brand-900 hover:bg-brand-950' },
    amber: { bg: 'bg-brand-50', border: 'border-brand-200', text: 'text-brand-600', button: 'bg-brand-900 hover:bg-brand-950' },
    green: { bg: 'bg-brand-50', border: 'border-brand-200', text: 'text-brand-600', button: 'bg-brand-900 hover:bg-brand-950' },
  };

  const colors = colorMap[info.color as keyof typeof colorMap];

  const handleJoin = async () => {
    // Joining happens against a specific Equb (see /join-equb and
    // api.equbAPI.join(equbId)), so route the user there to pick one.
    router.push('/join-equb');
    onClose();
  };

  const handleClose = () => {
    setStep('confirm');
    setError('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`${colors.bg} border-b ${colors.border} px-3 py-2 flex items-center justify-between`}>
              <h3 className="text-sm font-bold text-[#00d9ff]">{info.title}</h3>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-3">
              <AnimatePresence mode="wait">
                {step === 'confirm' && (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {/* Details */}
                    <div className="space-y-1.5 mb-3">
                      <div className={`p-2 ${colors.bg} border ${colors.border} rounded`}>
                        <p className="text-xs text-gray-600 font-semibold">Contribution</p>
                        <p className="text-sm font-bold text-[#00d9ff]">{info.contribution}</p>
                      </div>

                      <div className={`p-2 ${colors.bg} border ${colors.border} rounded`}>
                        <p className="text-xs text-gray-600 font-semibold">Duration</p>
                        <p className="text-sm font-bold text-[#00d9ff]">{info.duration}</p>
                      </div>

                      <div className={`p-2 ${colors.bg} border ${colors.border} rounded`}>
                        <p className="text-xs text-gray-600 font-semibold">Payout</p>
                        <p className="text-sm font-bold text-[#00d9ff]">{info.potSize}</p>
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="bg-gray-50 p-2 rounded border border-gray-200 mb-3">
                      <p className="text-xs font-semibold text-[#00d9ff] mb-1">Agree to:</p>
                      <ul className="space-y-0.5 text-xs text-[#00d9ff]">
                        <li className="flex items-start gap-1">
                          <span className="text-brand-600">✓</span>
                          <span>Contributions on time</span>
                        </li>
                        <li className="flex items-start gap-1">
                          <span className="text-brand-600">✓</span>
                          <span>Accept winners</span>
                        </li>
                        <li className="flex items-start gap-1">
                          <span className="text-brand-600">✓</span>
                          <span>Continue after winning</span>
                        </li>
                        <li className="flex items-start gap-1">
                          <span className="text-brand-600">✓</span>
                          <span>Follow rules</span>
                        </li>
                      </ul>
                    </div>

                    {/* Error */}
                    {error && (
                      <div className="p-2 bg-brand-50 border border-brand-200 rounded mb-2">
                        <p className="text-xs text-brand-700 font-semibold">{error}</p>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleClose}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded font-bold text-xs text-[#00d9ff] hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleJoin}
                        className={`flex-1 px-2 py-1.5 ${colors.button} text-[#00d9ff] font-bold text-xs rounded`}
                      >
                        Join Now
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 'joining' && (
                  <motion.div
                    key="joining"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-4"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="text-2xl mb-2"
                    >
                      ⏳
                    </motion.div>
                    <p className="text-xs font-bold text-[#00d9ff]">Processing...</p>
                  </motion.div>
                )}

                {step === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center py-4"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="text-3xl mb-2"
                    >
                      ✓
                    </motion.div>

                    <h4 className="text-sm font-bold text-[#00d9ff] text-center mb-1">
                      Success!
                    </h4>

                    <div className={`w-full p-2 ${colors.bg} border ${colors.border} rounded mb-2`}>
                      <p className="text-xs font-bold text-[#00d9ff]">Next: Make first contribution</p>
                    </div>

                    <button
                      onClick={() => {
                        handleClose();
                        setTimeout(() => {
                          router.push('/dashboard');
                        }, 300);
                      }}
                      className={`w-full px-2 py-1.5 ${colors.button} text-[#00d9ff] font-bold text-xs rounded`}
                    >
                      Go to Dashboard
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
