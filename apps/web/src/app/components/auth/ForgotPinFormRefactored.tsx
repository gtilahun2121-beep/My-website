'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import FormSuccess from '@/app/components/forms/FormSuccess';
import PhoneResetStep from './components/PhoneResetStep';
import OtpResetStep from './components/OtpResetStep';
import NewPinStep from './components/NewPinStep';
import { authAPI } from '@/app/services/api';

type ResetStep = 'phone' | 'otp' | 'newpin' | 'success';

interface ForgotPinFormRefactoredProps {
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

export default function ForgotPinFormRefactored({
  onSuccess,
  onError,
}: ForgotPinFormRefactoredProps) {
  const [step, setStep] = useState<ResetStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const handlePhoneSubmit = async () => {
    setError('');
    if (!phoneNumber.match(/^\+251 7[9]\d{8}$/)) {
      setError('Invalid phone number format (must be +251 7x/9x XXXXXXXX)');
      onError?.('Error', 'Invalid phone number format', 3000);
      return;
    }
    try {
      await authAPI.forgotPin(phoneNumber);
      console.log('SMS sent:', phoneNumber);
      onSuccess?.('SMS Sent', `Verification code sent to ${phoneNumber}`, 3000);
      setError('');
      setStep('otp');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      onError?.('Error', message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    setError('');
    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      setError('OTP must be exactly 6 digits');
      onError?.('Error', 'OTP must be exactly 6 digits', 3000);
      return;
    }
    try {
      const response = await authAPI.verifyOTP(phoneNumber, otp);
      if (!response.verified) {
        setError('Invalid OTP');
        onError?.('Error', 'Invalid OTP', 3000);
        return;
      }
      console.log('OTP verified:', otp);
      onSuccess?.('OTP Verified', 'Code verified successfully', 3000);
      setError('');
      setStep('newpin');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      onError?.('Error', message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPin = async () => {
    setError('');
    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      setError('PIN must be exactly 6 digits');
      onError?.('Error', 'PIN must be 6 digits', 3000);
      return;
    }
    if (newPin !== confirmPin) {
      setError('PINs do not match');
      onError?.('Error', 'PINs do not match', 3000);
      return;
    }
    try {
      await authAPI.resetPin(phoneNumber, otp, newPin);
      console.log('PIN reset for:', phoneNumber);
      onSuccess?.('✅ PIN Reset', 'Your access code has been reset successfully', 4000);
      setError('');
      setStep('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      onError?.('Error', message, 3000);
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
      className="glass-form rounded-2xl p-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
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

      {step === 'otp' && (
        <OtpResetStep
          otp={otp}
          onOtpChange={setOtp}
          onVerify={handleOtpSubmit}
          onBack={handleBackFromOtp}
          loading={loading}
          error={error}
          onErrorDismiss={() => setError('')}
        />
      )}

      {step === 'newpin' && (
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
      )}

      {step === 'success' && (
        <FormSuccess
          title="✅ PIN Reset Successful!"
          message="Your access code has been reset. You can now sign in with your new PIN."
          icon="🔐"
        />
      )}
    </motion.div>
  );
}
