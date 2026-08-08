'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import FormSuccess from '@/app/components/forms/FormSuccess';
import PhoneResetStep from './components/PhoneResetStep';
import OtpResetStep from './components/OtpResetStep';
import NewPinStep from './components/NewPinStep';
import AuthService from '@/app/services/authService';

/**
 * Refactored Forgot PIN Form Component
 * Clear state machine with proper validation and error handling
 */

type ResetStep = 'phone' | 'otp' | 'newpin' | 'success';

interface ForgotPinFormRefactoredProps {
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

export default function ForgotPinFormRefactored({
  onSuccess,
  onError,
}: ForgotPinFormRefactoredProps) {
  // Step tracking
  const [step, setStep] = useState<ResetStep>('phone');

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userData, setUserData] = useState<any>(null);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Handlers
  const handlePhoneSubmit = async () => {
    setLoading(true);
    try {
      if (!AuthService.isValidPhone(phoneNumber)) {
        throw new Error('Invalid phone number format (must be +251 7x/9x XXXXXXXX)');
      }

      // Simulate OTP dispatch — real backend endpoint pending
      await new Promise((resolve) => setTimeout(resolve, 1000));

      onSuccess?.('SMS Sent', `Verification code sent to ${phoneNumber}`, 3000);
      setError('');
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
      onError?.('Error', err.message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    setLoading(true);
    try {
      if (otp.length !== 6 || !/^\d+$/.test(otp)) {
        throw new Error('OTP must be exactly 6 digits');
      }

      // Simulate OTP validation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      onSuccess?.('OTP Verified', 'Code verified successfully', 3000);
      setError('');
      setStep('newpin');
    } catch (err: any) {
      setError(err.message);
      onError?.('Error', err.message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPin = async () => {
    setLoading(true);
    try {
      if (!AuthService.isValidPhone(phoneNumber)) {
        throw new Error('Phone number invalid');
      }
      if (!AuthService.isValidPin(newPin)) {
        throw new Error('PIN must be exactly 4 digits');
      }
      if (newPin !== confirmPin) {
        throw new Error('PINs do not match');
      }

      // NOTE: Backend PIN-reset endpoint not yet available.
      // Simulate success for the UI flow demo.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setUserData({ phoneNumber });

      onSuccess?.(
        '✅ PIN Reset',
        'Your access code has been reset successfully',
        4000
      );
      setError('');
      setStep('success');
    } catch (err: any) {
      setError(err.message);
      onError?.('Error', err.message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromOtp = () => {
    setStep('phone');
    setError('');
    setOtp('');
  };

  const handleBackFromNewPin = () => {
    setStep('otp');
    setError('');
    setNewPin('');
    setConfirmPin('');
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
        <PhoneResetStep
          phoneNumber={phoneNumber}
          onPhoneChange={setPhoneNumber}
          onContinue={handlePhoneSubmit}
          loading={loading}
          error={error}
          onErrorDismiss={() => setError('')}
        />
      )}

      {/* Step 2: OTP Verification */}
      {step === 'otp' && (
        <>
          <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-700 font-bold">📱 Phone: {phoneNumber}</p>
          </div>
          <OtpResetStep
            otp={otp}
            onOtpChange={setOtp}
            onVerify={handleOtpSubmit}
            onBack={handleBackFromOtp}
            loading={loading}
            error={error}
            onErrorDismiss={() => setError('')}
          />
        </>
      )}

      {/* Step 3: Set New PIN */}
      {step === 'newpin' && (
        <>
          <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-3 space-y-1">
            <p className="text-xs text-blue-700 font-bold">📱 Phone: {phoneNumber}</p>
            <p className="text-xs text-blue-700 font-bold">✓ OTP Verified</p>
          </div>
          <NewPinStep
            newPin={newPin}
            confirmPin={confirmPin}
            onNewPinChange={setNewPin}
            onConfirmPinChange={setConfirmPin}
            onReset={handleSetNewPin}
            onBack={handleBackFromNewPin}
            loading={loading}
            error={error}
            onErrorDismiss={() => setError('')}
          />
        </>
      )}

      {/* Step 4: Success */}
      {step === 'success' && userData && (
        <>
          <FormSuccess
            title="✅ PIN Reset Successful!"
            message="Your access code has been reset. You can now sign in with your new PIN."
            icon="🔐"
          />
          <div className="mt-6 bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <p className="text-sm font-bold text-green-900 mb-3">✓ What's Next:</p>
            <ul className="space-y-1 text-xs text-green-800">
              <li>✓ Use your phone number to sign in</li>
              <li>✓ Enter your new 4-digit PIN</li>
              <li>✓ Access your Equb account</li>
            </ul>
          </div>
          <motion.button
            onClick={() => (window.location.href = '/auth')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 mt-6 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300"
          >
            🔐 Go to Sign In
          </motion.button>
        </>
      )}
    </motion.div>
  );
}
