'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);

  // Step 1: Phone verification
  const handlePhoneSubmit = async () => {
    setError('');
    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      setError('Invalid phone number format');
      onError?.('Invalid Number', 'Please enter a valid phone number', 3000);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const storedUser = localStorage.getItem(`qalnet_user_${phoneNumber}`);
      if (!storedUser) {
        setError('User not found. Please check your phone number.');
        onError?.('Account Not Found', 'Phone number not registered', 3000);
        setLoading(false);
        return;
      }

      onSuccess?.('SMS Sent', `Verification code sent to ${phoneNumber}`, 3000);
      setLoading(false);
      setStep('otp');
    }, 1000);
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
    setTimeout(() => {
      // Demo: Accept any 6-digit code or specific test codes
      if (otp === '000000' || otp.length === 6) {
        onSuccess?.('OTP Verified', 'Code verified successfully', 3000);
        setLoading(false);
        setStep('newpin');
      } else {
        setError('Invalid OTP code');
        onError?.('Invalid Code', 'The OTP you entered is incorrect', 3000);
        setLoading(false);
      }
    }, 1000);
  };

  // Step 3: Set new PIN
  const handleSetNewPin = async () => {
    setError('');
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setError('PIN must be exactly 4 digits');
      onError?.('Invalid PIN', 'PIN must be 4 digits', 3000);
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
      onError?.('PIN Mismatch', 'New PINs must be the same', 3000);
      return;
    }

    setLoading(true);
    setTimeout(() => {
      // Update user PIN in localStorage
      const storedUser = localStorage.getItem(`qalnet_user_${phoneNumber}`);
      if (storedUser) {
        const user = JSON.parse(storedUser);
        user.pin = newPin;
        localStorage.setItem(`qalnet_user_${phoneNumber}`, JSON.stringify(user));
        setUserData(user);
        onSuccess?.('✅ PIN Reset', 'Your access code has been reset successfully', 4000);
        setLoading(false);
        setStep('success');
      }
    }, 1500);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      className="bg-white rounded-2xl p-8 shadow-xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Step 1: Phone Verification */}
      {step === 'phone' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
            🔐 Reset Access Code
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Enter your phone number to receive a verification code
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
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold"
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
              {loading ? '⏳ Sending Code...' : '📱 Send Verification Code'}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Step 2: OTP Verification */}
      {step === 'otp' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
            ✉️ Verify Code
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Enter the 6-digit code sent to your phone
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                Verification Code
              </label>
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold text-3xl text-center tracking-widest"
              />
              <p className="text-xs text-[#5a5a5a] mt-2 text-center">
                Demo: Use any 6-digit code
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
              onClick={handleOtpSubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#ce1126] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Verify Code'}
            </motion.button>

            <button
              onClick={() => {
                setStep('phone');
                setError('');
                setOtp('');
              }}
              className="w-full py-2 text-[#0d7e4d] font-bold hover:underline"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Set New PIN */}
      {step === 'newpin' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
            🔑 Create New Access Code
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Set a new 4-digit PIN to secure your account
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                New 4-Digit PIN
              </label>
              <input
                type="password"
                placeholder="••••"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold text-2xl text-center tracking-widest"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                You'll use this to sign in
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                Confirm PIN
              </label>
              <input
                type="password"
                placeholder="••••"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold text-2xl text-center tracking-widest"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                Must match the new PIN above
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
              onClick={handleSetNewPin}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#ce1126] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
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
              className="w-full py-2 text-[#0d7e4d] font-bold hover:underline"
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
          <h3 className="text-2xl font-black text-[#0d7e4d] mb-4">
            PIN Reset Successful!
          </h3>
          <p className="text-gray-600 mb-6">
            Your access code has been successfully reset
          </p>

          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-bold text-green-900 mb-2">✓ What's Next:</p>
            <ul className="space-y-1 text-xs text-green-800">
              <li>✓ Use your phone number to sign in</li>
              <li>✓ Enter your new 4-digit PIN</li>
              <li>✓ Access your Equb account</li>
            </ul>
          </div>

          <motion.button
            onClick={() => window.location.href = '/auth'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300"
          >
            🔐 Go to Sign In
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
