'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { authAPI } from '@/app/services/api';

interface ForgotPinFormProps {
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type ForgotPinStep = 'phone' | 'otp' | 'newpin' | 'success';

export default function ForgotPinForm({ onSuccess, onError }: ForgotPinFormProps) {
  const [step, setStep] = useState<ForgotPinStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Step 1: Phone verification
  const handlePhoneSubmit = async () => {
    setError('');
    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      setError('Invalid phone number format');
      onError?.('Invalid Number', 'Please enter a valid phone number', 3000);
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPin(phoneNumber);
      console.log('SMS sent:', phoneNumber);
      onSuccess?.('SMS Sent', `Verification code sent to ${phoneNumber}`, 3000);
      setLoading(false);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
      setLoading(false);
    }
  };

  // Step 2: OTP verification
  const handleOtpSubmit = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      onError?.('Invalid OTP', 'Code must be exactly 6 digits', 3000);
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.verifyOTP(phoneNumber, otp);
      if (!response.verified) {
        setError('Invalid OTP');
        onError?.('Invalid OTP', 'The code you entered is incorrect', 3000);
        setLoading(false);
        return;
      }
      console.log('OTP verified:', otp);
      onSuccess?.('OTP Verified', 'Code verified successfully', 3000);
      setLoading(false);
      setStep('newpin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
      setLoading(false);
    }
  };

  // Step 3: Set new PIN
  const handleSetNewPin = async () => {
    setError('');
    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      setError('PIN must be exactly 6 digits');
      onError?.('Invalid PIN', 'PIN must be 6 digits', 3000);
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
      onError?.('PIN Mismatch', 'New PINs must be the same', 3000);
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPin(phoneNumber, otp, newPin);
      console.log('PIN reset for:', phoneNumber);
      onSuccess?.('✅ PIN Reset', 'Your access code has been reset successfully', 4000);
      setLoading(false);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset PIN');
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="glass-form rounded-2xl p-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Step 1: Phone Verification */}
      {step === 'phone' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#314fa0] mb-2 text-center">
            🔐 Reset Access Code
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Enter your phone number to receive a verification code
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#314fa0] mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+251911223344"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#314fa0] font-bold"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                Same number you used to register
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded"
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
              {loading ? '⏳ Sending Code...' : '📱 Send Verification Code'}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Step 2: OTP Verification */}
      {step === 'otp' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#314fa0] mb-2 text-center">
            ✉️ Verify Code
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Enter the 6-digit code sent to your phone
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#314fa0] mb-2">
                Verification Code
              </label>
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#314fa0] font-bold text-3xl text-center tracking-widest"
              />
              <p className="text-xs text-[#5a5a5a] mt-2 text-center">
                Check your SMS for the code
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handleOtpSubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Verify Code'}
            </motion.button>

            <button
              onClick={() => {
                setStep('phone');
                setError('');
                setOtp('');
              }}
              className="w-full py-2 text-[#314fa0] font-bold hover:underline"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Set New PIN */}
      {step === 'newpin' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#314fa0] mb-2 text-center">
            🔑 Create New Access Code
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Set a new 6-digit PIN to secure your account
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#314fa0] mb-2">
                New 6-Digit PIN
              </label>
              <div className="relative">
                <input
                  type={showNewPin ? 'text' : 'password'}
                  placeholder="••••"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 pr-11 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#314fa0] font-bold text-2xl text-center tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin((v) => !v)}
                  aria-label="Show/Hide PIN"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-[#314fa0] hover:bg-gray-100 transition-colors"
                >
                  {!showNewPin ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-[#5a5a5a] mt-1">
                You&apos;ll use this to sign in
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#314fa0] mb-2">
                Confirm PIN
              </label>
              <div className="relative">
                <input
                  type={showConfirmPin ? 'text' : 'password'}
                  placeholder="••••"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 pr-11 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-[#314fa0] font-bold text-2xl text-center tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPin((v) => !v)}
                  aria-label="Show/Hide PIN"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-[#314fa0] hover:bg-gray-100 transition-colors"
                >
                  {!showConfirmPin ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  )}
                </button>
              </div>
              <p className="text-xs text-[#5a5a5a] mt-1">
                Must match the new PIN above
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handleSetNewPin}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Resetting...' : '✓ Reset PIN'}
            </motion.button>

            <button
              onClick={() => {
                setStep('otp');
                setError('');
                setNewPin('');
                setConfirmPin('');
              }}
              className="w-full py-2 text-[#314fa0] font-bold hover:underline"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Success */}
      {step === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-6xl mb-4 animate-bounce">✅</div>
          <h3 className="text-2xl font-black text-[#314fa0] mb-4">
            PIN Reset Successful!
          </h3>
          <p className="text-gray-600 mb-6">
            Your access code has been successfully reset
          </p>

          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-bold text-green-900 mb-2">✓ What&apos;s Next:</p>
            <ul className="space-y-1 text-xs text-green-800">
              <li>✓ Use your phone number to sign in</li>
              <li>✓ Enter your new 6-digit PIN</li>
              <li>✓ Access your Equb account</li>
            </ul>
          </div>

          <motion.button
            onClick={() => window.location.href = '/auth'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white font-black rounded-full hover:shadow-lg transition-all duration-300"
          >
            🔐 Go to Sign In
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}