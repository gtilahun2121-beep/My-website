'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';

interface LoginFormProps {
  lang: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type LoginStep = 'phone' | 'pin' | 'success';

export default function LoginForm({ onSuccess, onError }: LoginFormProps) {
  const { signin, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect on success — immediate, no delay
  useEffect(() => {
    if (step === 'success') {
      router.push('/');
    }
  }, [step, router]);

  // Step 1: Enter phone or email
  const handlePhoneSubmit = () => {
    setError('');
    // Allow basic email formats OR phone numbers (can start with 0 or +)
    const isPhone = /^\+?[0-9]{9,15}$/.test(phoneNumber.trim());
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(phoneNumber.trim());
    
    if (!isPhone && !isEmail) {
      setError('Invalid phone number or email format');
      onError?.('Invalid Identifier', 'Please enter a valid phone number or email', 3000);
      return;
    }

    onSuccess?.('Account Found', 'Enter your PIN to continue', 3000);
    setStep('pin');
  };

  // Step 2: Verify PIN against the real backend
  const handlePinSubmit = async () => {
    setError('');
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError('PIN must be exactly 6 digits');
      onError?.('Invalid PIN', 'PIN must be exactly 6 digits', 3000);
      return;
    }

    setLoading(true);
    try {
      await signin(phoneNumber, pin);
      // Navigate immediately — don't wait on the success screen.
      // refreshProfile() fires in the background from AuthContext.signin().
      onSuccess?.('🎉 Welcome Back!', 'Redirecting to dashboard…', 3000);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <motion.div
      className="card-eth p-8 rounded-2xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Step 1: Phone Number */}
      {step === 'phone' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#314fa0] mb-2 text-center">
            🔐 Sign In
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Enter your phone or email and PIN
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#314fa0] mb-2">
                Phone Number or Email
              </label>
              <input
                type="text"
                placeholder="+251911223344 or email@example.com"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#314fa0] font-bold text-lg"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                Same phone or email you used to register
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handlePhoneSubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Continue'}
            </motion.button>

            <p className="text-center text-sm text-[#5a5a5a] mb-6">
              Don&apos;t have an account?{' '}
              <a href="/auth?mode=register" className="text-[#314fa0] font-black hover:underline">
                Sign up here
              </a>
            </p>
          </div>
        </motion.div>
      )}

      {/* Step 2: PIN Entry */}
      {step === 'pin' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#314fa0] mb-2 text-center">
            🔐 Enter Your PIN
          </h3>
          <p className="text-sm text-center text-[#5a5a5a] mb-6">
            Account: {phoneNumber}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#314fa0] mb-2">
                6-Digit Security PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  placeholder="••••"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#314fa0] font-bold text-3xl text-center tracking-widest pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-[#314fa0] hover:bg-gray-100 transition-colors"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-[#5a5a5a] mt-1">
                Enter the PIN you set during registration
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handlePinSubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '🔓 Login'}
            </motion.button>

            <button
              onClick={() => {
                setStep('phone');
                setError('');
                setPin('');
              }}
              className="w-full py-2 text-[#314fa0] font-bold hover:underline"
            >
              ← Use Different Account
            </button>
          </div>

          {/* Forgot PIN Section */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-center text-sm text-[#5a5a5a] mb-3">
              Forgot your PIN?
            </p>
            <motion.button
              onClick={() => {
                const forgotTab = document.querySelector('button:nth-of-type(4)') as HTMLButtonElement;
                forgotTab?.click();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-2 border-2 border-slate-300 text-[#314fa0] font-bold rounded-lg hover:bg-[#314fa0]/10 transition-all"
            >
              🆘 Reset PIN
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Login Success */}
      {step === 'success' && user && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            className="text-6xl mb-6"
            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.6 }}
          >
            ✅
          </motion.div>

          <h3 className="text-2xl font-black text-[#314fa0] mb-4">
            Welcome Back!
          </h3>
          <p className="text-gray-600 mb-6">
            Hello, {`${user.firstName} ${user.lastName}`.trim() || 'QalNet Member'}! 👋
          </p>

          <div className="bg-[#314fa0]/10 border-2 border-[#314fa0] rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-bold text-[#314fa0] mb-3">✓ Account Details:</p>
            <div className="space-y-2 text-xs text-gray-600">
              <p>📱 Phone: {user.phoneNumber}</p>
              <p>👤 Name: {`${user.firstName} ${user.lastName}`.trim()}</p>
              <p>📧 Email: {user.email || '—'}</p>
              <p>⏰ Member Since: {new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <motion.button
            onClick={() => router.push('/')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 mb-3"
          >
            🎯 Go to Dashboard
          </motion.button>

          <motion.button
            onClick={() => router.push('/')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-2 border-2 border-[#314fa0] text-[#314fa0] font-bold rounded-full hover:bg-[#314fa0]/10 transition-all"
          >
            🏠 Go to Home
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
