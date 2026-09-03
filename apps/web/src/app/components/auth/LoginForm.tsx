'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth, TwoFactorRequiredError } from '@/app/context/AuthContext';

interface LoginFormProps {
  lang: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type LoginStep = 'phone' | 'pin' | '2fa' | 'success';

export default function LoginForm({ onSuccess, onError }: LoginFormProps) {
  const { signin, verify2FALogin, user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
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
    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4-6 digits');
      onError?.('Invalid PIN', 'PIN must be 4-6 digits', 3000);
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
      if (err instanceof TwoFactorRequiredError) {
        // 2FA enabled on this account — collect the authenticator code.
        setMfaToken(err.mfaToken);
        setStep('2fa');
        setError('');
        setPin('');
        onSuccess?.('Two-Factor Authentication', 'Enter the 6-digit code from your authenticator app', 3000);
        return;
      }
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  // Step 3: Complete login with the TOTP/backup code
  const handle2FASubmit = async () => {
    setError('');
    const code = otpCode.trim();
    if (code.length < 6 || code.length > 20) {
      setError('Enter the 6-digit code from your authenticator app, or a backup code');
      return;
    }

    setLoading(true);
    try {
      await verify2FALogin(mfaToken, code);
      onSuccess?.('🎉 Welcome Back!', 'Redirecting to dashboard…', 3000);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
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
      className="glass-form p-8 rounded-2xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Step 1: Phone Number */}
      {step === 'phone' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#00d9ff] mb-2 text-center">
            🔐 Sign In
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Enter your phone or email and PIN
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#00d9ff] mb-2">
                Phone Number or Email
              </label>
              <input
                type="text"
                placeholder="+251911223344 or email@example.com"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#001f3f] font-bold text-lg"
              />
              <p className="text-xs text-[#ffffff] mt-1">
                Same phone or email you used to register
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-100 border-l-4 border-brand-500 text-brand-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handlePhoneSubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Continue'}
            </motion.button>

            <p className="text-center text-sm text-[#ffffff] mb-6">
              Don&apos;t have an account?{' '}
              <a href="/auth?mode=register" className="text-[#00d9ff] font-black hover:underline">
                Sign up here
              </a>
            </p>
          </div>
        </motion.div>
      )}

      {/* Step 2: PIN Entry */}
      {step === 'pin' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#00d9ff] mb-2 text-center">
            🔐 Enter Your PIN
          </h3>
          <p className="text-sm text-center text-[#ffffff] mb-6">
            Account: {phoneNumber}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#00d9ff] mb-2">
                6-Digit Security PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  placeholder="••••"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#001f3f] font-bold text-3xl text-center tracking-widest pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-[#00d9ff] hover:bg-gray-100 transition-colors"
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
              <p className="text-xs text-[#ffffff] mt-1">
                Enter the PIN you set during registration
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-100 border-l-4 border-brand-500 text-brand-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handlePinSubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '🔓 Login'}
            </motion.button>

            <button
              onClick={() => {
                setStep('phone');
                setError('');
                setPin('');
              }}
              className="w-full py-2 text-[#00d9ff] font-bold hover:underline"
            >
              ← Use Different Account
            </button>
          </div>

          {/* Forgot PIN Section */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-sm text-[#ffffff] mb-3">
              Forgot your PIN?
            </p>
            <motion.button
              onClick={() => {
                const forgotTab = document.querySelector('button:nth-of-type(4)') as HTMLButtonElement;
                forgotTab?.click();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-2 border-2 border-gray-300 text-[#00d9ff] font-bold rounded-lg hover:bg-[#001f3f]/10 transition-all"
            >
              🆘 Reset PIN
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Two-Factor Authentication */}
      {step === '2fa' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#00d9ff] mb-2 text-center">
            🔐 Two-Factor Authentication
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Enter the 6-digit code from your authenticator app (or a backup code).
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#00d9ff] mb-2">
                Authentication Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 20))}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#001f3f] font-bold text-3xl text-center tracking-widest"
              />
              <p className="text-xs text-[#ffffff] mt-1">
                Backup codes are single-use and formatted like XXXX-XXXX.
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-100 border-l-4 border-brand-500 text-brand-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handle2FASubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '🔓 Verify & Sign In'}
            </motion.button>

            <button
              onClick={() => {
                setStep('pin');
                setOtpCode('');
                setError('');
              }}
              className="w-full py-2 text-[#00d9ff] font-bold hover:underline"
            >
              ← Use a different code
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Login Success */}
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

          <h3 className="text-2xl font-black text-[#00d9ff] mb-4">
            Welcome Back!
          </h3>
          <p className="text-gray-600 mb-6">
            Hello, {`${user.firstName} ${user.lastName}`.trim() || 'QalNet Member'}! 👋
          </p>

          <div className="bg-[#001f3f]/10 border-2 border-[#001f3f] rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-bold text-[#00d9ff] mb-3">✓ Account Details:</p>
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
            className="w-full py-3 bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] font-black rounded-full hover:shadow-lg transition-all duration-300 mb-3"
          >
            🎯 Go to Dashboard
          </motion.button>

          <motion.button
            onClick={() => router.push('/')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-2 border-2 border-[#001f3f] text-[#00d9ff] font-bold rounded-full hover:bg-[#001f3f]/10 transition-all"
          >
            🏠 Go to Home
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}

