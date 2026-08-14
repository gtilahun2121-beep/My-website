'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Language } from '@/i18n/config';
import { EqubCategory } from '@/app/data/equbCategories';
import EqubSelectionStep from './EqubSelectionStep';
import PhoneVerificationStep from './PhoneVerificationStep';
import OtpVerificationStep from './OtpVerificationStep';
import DetailsEntryStep from './DetailsEntryStep';
import FormSuccess from '@/app/components/forms/FormSuccess';
import { useAuth } from '@/app/context/AuthContext';

interface RegistrationFormRefactoredProps {
  lang: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type RegistrationStep = 'equb' | 'phone' | 'otp' | 'details' | 'success';

/**
 * Refactored Registration Form Component
 * Orchestrates multi-step registration flow with clear separation of concerns
 */
export default function RegistrationFormRefactored({
  lang,
  onSuccess,
  onError,
}: RegistrationFormRefactoredProps) {
  // Step tracking
  const [step, setStep] = useState<RegistrationStep>('equb');

  // Step state
  const [selectedEqub, setSelectedEqub] = useState<EqubCategory | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [faydaNumber, setFaydaNumber] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedUser, setCompletedUser] = useState<string>('');

  const { signup } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Handlers
  const handleEqubSelect = (equb: EqubCategory) => {
    setSelectedEqub(equb);
  };

  const handleContinueFromEqub = () => {
    if (!selectedEqub) {
      setError('Please select an Equb group');
      onError?.('No Selection', 'Please choose a profession-based Equb group', 3000);
      return;
    }
    setError('');
    onSuccess?.('Equb Selected', `You selected ${selectedEqub.name}`, 3000);
    setStep('phone');
  };

  const handlePhoneContinue = async () => {
    setLoading(true);
    try {
      // Validate phone
      if (!phoneNumber) {
        throw new Error('Phone number is required');
      }
      if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
        throw new Error('Invalid phone number format');
      }

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onSuccess?.('SMS Sent', `Verification code sent to ${phoneNumber}`, 3000);
      setStep('otp');
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      onError?.('Error', message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    setLoading(true);
    try {
      // Simulate OTP validation
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (otp.length !== 6) {
        throw new Error('Invalid OTP format');
      }
      onSuccess?.('OTP Verified', 'Code verified successfully', 3000);
      setStep('details');
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      onError?.('Error', message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsComplete = async () => {
    setLoading(true);
    try {
      if (!selectedEqub) throw new Error('Equb selection missing');

      // Validate all fields before registration
      if (!fullName || fullName.length < 3) {
        throw new Error('Full name must be at least 3 characters');
      }
      if (!pin || pin.length !== 4) {
        throw new Error('PIN must be exactly 4 digits');
      }
      if (pin !== confirmPin) {
        throw new Error('PINs do not match');
      }
      if (!faydaNumber || !/^\d{6,16}$/.test(faydaNumber)) {
        throw new Error('Fayda number must be 6-16 digits');
      }

      // Split full name into first/last for the backend
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || fullName;
      const lastName = nameParts.slice(1).join(' ') || '';

      await signup({
        firstName,
        lastName,
        email: `user-${phoneNumber.replace(/\D/g, '')}@qalnet.app`, // placeholder email
        password: pin,
        phoneNumber,
        fayda: faydaNumber,
      });
      setCompletedUser(fullName);
      onSuccess?.(
        '✅ Account Created',
        `Welcome to QalNet, ${fullName}! Your account is ready.`,
        5000
      );
      setStep('success');
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      onError?.('Registration Failed', message, 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromPhone = () => {
    setStep('equb');
    setError('');
  };

  const handleBackFromOtp = () => {
    setStep('phone');
    setError('');
  };

  const handleBackFromDetails = () => {
    setStep('otp');
    setError('');
  };

  const handleChangeEqub = () => {
    setStep('equb');
    setError('');
  };

  return (
    <motion.div
      className="card-eth p-8 rounded-2xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Step: Equb Selection */}
      {step === 'equb' && (
        <>
          <EqubSelectionStep onSelect={handleEqubSelect} selected={selectedEqub} />
          <motion.button
            onClick={handleContinueFromEqub}
            disabled={!selectedEqub}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 mt-6 bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
          >
            ✓ Continue with Selected Equb
          </motion.button>
        </>
      )}

      {/* Step: Phone Verification */}
      {step === 'phone' && (
        <>
          <PhoneVerificationStep
            phoneNumber={phoneNumber}
            onPhoneChange={setPhoneNumber}
            onContinue={handlePhoneContinue}
            loading={loading}
            error={error}
            onErrorDismiss={() => setError('')}
          />
          <button
            onClick={handleBackFromPhone}
            className="w-full py-2 mt-4 text-[#314fa0] font-bold hover:underline"
          >
            ← Change Equb Group
          </button>
        </>
      )}

      {/* Step: OTP Verification */}
      {step === 'otp' && (
        <>
          <div className="mb-4 bg-slate-100 border-2 border-slate-300 rounded-lg p-3">
            <p className="text-xs text-[#314fa0] font-bold">📱 Phone: {phoneNumber}</p>
          </div>
          <OtpVerificationStep
            otp={otp}
            onOtpChange={setOtp}
            onVerify={handleOtpVerify}
            onBack={handleBackFromOtp}
            loading={loading}
            error={error}
            onErrorDismiss={() => setError('')}
          />
        </>
      )}

      {/* Step: Details Entry */}
      {step === 'details' && (
        <>
          <div className="mb-4 bg-slate-100 border-2 border-slate-300 rounded-lg p-3 space-y-1">
            <p className="text-xs text-[#314fa0] font-bold">📱 Phone: {phoneNumber}</p>
            <p className="text-xs text-[#314fa0] font-bold">🏢 Equb: {selectedEqub?.name}</p>
          </div>
          <DetailsEntryStep
            fullName={fullName}
            pin={pin}
            confirmPin={confirmPin}
            faydaNumber={faydaNumber}
            onFullNameChange={setFullName}
            onPinChange={setPin}
            onConfirmPinChange={setConfirmPin}
            onFaydaChange={setFaydaNumber}
            onComplete={handleDetailsComplete}
            onBack={handleBackFromDetails}
            loading={loading}
            error={error}
            onErrorDismiss={() => setError('')}
          />
        </>
      )}

      {/* Step: Success */}
      {step === 'success' && completedUser && (
        <>
          <FormSuccess
            title="✅ Registration Complete!"
            message="Your account has been created successfully"
            icon="🎉"
          />
          <div className="mt-6 bg-slate-100 border-2 border-slate-300 rounded-lg p-4 space-y-2 text-sm">
            <p className="font-bold text-[#314fa0] mb-3">Account Summary:</p>
            <p className="text-gray-700">
              <span className="font-bold">👤 Name:</span> {fullName}
            </p>
            <p className="text-gray-700">
              <span className="font-bold">📱 Phone:</span> {phoneNumber}
            </p>
            <p className="text-gray-700">
              <span className="font-bold">🏢 Equb:</span> {selectedEqub?.name}
            </p>
            <p className="text-gray-700">
              <span className="font-bold">💵 Monthly:</span> ETB {selectedEqub?.monthlyPayment}
            </p>
            <p className="text-gray-700">
              <span className="font-bold">🎫 Fayda:</span> {faydaNumber}
            </p>
          </div>
          <motion.button
            onClick={() => window.location.href = '/auth?tab=login'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 mt-6 bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white font-black rounded-full hover:shadow-lg transition-all"
          >
            🔐 Go to Sign In
          </motion.button>
        </>
      )}
    </motion.div>
  );
}
