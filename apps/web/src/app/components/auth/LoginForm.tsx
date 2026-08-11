'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';

interface LoginFormProps {
  lang: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type LoginStep = 'phone' | 'pin' | 'success';

export default function LoginForm({ lang, onSuccess, onError }: LoginFormProps) {
  const t = translations[lang];
  const { signin, user } = useAuth();
  const [step, setStep] = useState<LoginStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Enter phone number
  const handlePhoneSubmit = () => {
    setError('');
    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      setError('Invalid phone number format');
      onError?.('Invalid Number', 'Please enter a valid phone number', 3000);
      return;
    }

    onSuccess?.('Phone Found', 'Enter your PIN to continue', 3000);
    setStep('pin');
  };

  // Step 2: Verify PIN against the real backend
  const handlePinSubmit = async () => {
    setError('');
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      onError?.('Invalid PIN', 'PIN must be exactly 4 digits', 3000);
      return;
    }

    setLoading(true);
    try {
      await signin(phoneNumber, pin);
      onSuccess?.('🎉 Welcome Back!', `Hello ${user?.firstName ?? ''}, you're now logged in!`, 5000);
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'Login failed');
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
          <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
            🔐 Sign In
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Enter your phone and PIN
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+251911223344"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold text-lg"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                Same number you used to register
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
              className="w-full py-3 bg-gradient-to-r from-[#ce1126] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Continue'}
            </motion.button>

            <p className="text-center text-sm text-[#5a5a5a] mb-6">
              Don't have an account?{' '}
              <a href="/auth?mode=register" className="text-[#0d7e4d] font-black hover:underline">
                Sign up here
              </a>
            </p>
          </div>
        </motion.div>
      )}

      {/* Step 2: PIN Entry */}
      {step === 'pin' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
            🔐 Enter Your PIN
          </h3>
          <p className="text-sm text-center text-[#5a5a5a] mb-6">
            Phone: {phoneNumber}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                4-Digit Security PIN
              </label>
              <input
                type="password"
                placeholder="••••"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold text-3xl text-center tracking-widest"
              />
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
              className="w-full py-3 bg-gradient-to-r from-[#ce1126] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '🔓 Login'}
            </motion.button>

            <button
              onClick={() => {
                setStep('phone');
                setError('');
                setPin('');
              }}
              className="w-full py-2 text-[#0d7e4d] font-bold hover:underline"
            >
              ← Use Different Phone
            </button>
          </div>

          {/* Forgot PIN Section */}
          <div className="mt-6 pt-6 border-t border-[#d4af37]">
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
              className="w-full py-2 border-2 border-[#d4af37] text-[#0d7e4d] font-bold rounded-lg hover:bg-[#d4af37]/10 transition-all"
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

          <h3 className="text-2xl font-black text-[#0d7e4d] mb-4">
            Welcome Back!
          </h3>
          <p className="text-gray-600 mb-6">
            Hello, {`${user.firstName} ${user.lastName}`.trim() || 'QalNet Member'}! 👋
          </p>

          <div className="bg-[#0d7e4d]/10 border-2 border-[#0d7e4d] rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-bold text-[#0d7e4d] mb-3">✓ Account Details:</p>
            <div className="space-y-2 text-xs text-gray-600">
              <p>📱 Phone: {user.phoneNumber}</p>
              <p>👤 Name: {`${user.firstName} ${user.lastName}`.trim()}</p>
              <p>📧 Email: {user.email || '—'}</p>
              <p>⏰ Member Since: {new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <motion.button
            onClick={() => window.location.href = '/'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 mb-3"
          >
            🎯 Go to Dashboard
          </motion.button>

          <motion.button
            onClick={() => window.location.href = '/'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-2 border-2 border-[#0d7e4d] text-[#0d7e4d] font-bold rounded-full hover:bg-[#0d7e4d]/10 transition-all"
          >
            🏠 Go to Home
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
