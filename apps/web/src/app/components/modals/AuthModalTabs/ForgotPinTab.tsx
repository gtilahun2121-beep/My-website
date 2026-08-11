'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Language, defaultLanguage } from '@/i18n/config';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';
import FormSuccess from '@/app/components/forms/FormSuccess';
import { authAPI } from '@/app/services/api';
import { ValidationSchema } from '@/app/utils/validation';

interface ForgotPinTabProps {
  lang?: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type Step = 'phone' | 'otp' | 'newpin' | 'success';

export default function ForgotPinTab({ lang = defaultLanguage, onSuccess, onError }: ForgotPinTabProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);

  const clearErrors = () => setErrors({});

  // Step 1: Phone Verification — request the OTP from the real backend
  const handlePhoneSubmit = async () => {
    clearErrors();

    if (!phone.trim()) {
      setErrors({ phone: 'Phone number is required' });
      return;
    }

    const phoneValidation = ValidationSchema.validatePhone(phone);
    if (!phoneValidation.valid) {
      setErrors({ phone: phoneValidation.error || 'Invalid phone number format' });
      return;
    }

    setSending(true);
    try {
      const response = await authAPI.forgotPin(phone);
      if (!response.success) {
        setErrors({ phone: response.message });
        onError?.('Error', response.message);
        return;
      }
      setStep('otp');
      onSuccess?.('OTP Sent', `An OTP has been sent to ${phone}`, 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send OTP';
      setErrors({ phone: message });
      onError?.('Error', message);
    } finally {
      setSending(false);
    }
  };

  // Step 2: OTP Verification — check the code against the real backend
  const handleOtpSubmit = async () => {
    clearErrors();

    if (!otp.trim()) {
      setErrors({ otp: 'OTP is required' });
      return;
    }

    if (otp.length !== 6) {
      setErrors({ otp: 'OTP must be 6 digits' });
      return;
    }

    setVerifying(true);
    try {
      const response = await authAPI.verifyOTP(phone, otp);
      if (!response.verified) {
        setErrors({ otp: 'Invalid or expired OTP. Please request a new code.' });
        onError?.('Error', 'Invalid or expired OTP');
        return;
      }
      setStep('newpin');
      onSuccess?.('OTP Verified', 'Please create a new PIN', 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid OTP';
      setErrors({ otp: message });
      onError?.('Error', message);
    } finally {
      setVerifying(false);
    }
  };

  // Step 3: New PIN Creation — reset the PIN on the real backend
  const handleNewPinSubmit = async () => {
    clearErrors();

    const newErrors: Record<string, string> = {};

    if (!newPin) {
      newErrors.newPin = 'New PIN is required';
    } else if (newPin.length !== 4) {
      newErrors.newPin = 'PIN must be exactly 4 digits';
    }

    if (!confirmPin) {
      newErrors.confirmPin = 'Confirm PIN is required';
    } else if (confirmPin !== newPin) {
      newErrors.confirmPin = 'PINs do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setResetting(true);
    try {
      const response = await authAPI.resetPin(phone, otp, newPin);
      if (!response.success) {
        setErrors({ newPin: 'Failed to reset PIN. Please try again.' });
        onError?.('Error', 'Failed to reset PIN');
        return;
      }
      setStep('success');
      onSuccess?.('PIN Reset Successful', 'Your PIN has been updated. Please sign in again.', 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset PIN';
      setErrors({ newPin: errorMessage });
      onError?.('Error', errorMessage);
    } finally {
      setResetting(false);
    }
  };

  const handlePinChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '').slice(0, 4);
    return numericValue;
  };

  if (step === 'success') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <FormSuccess
          title="✓ PIN Reset Complete"
          message="Your PIN has been successfully updated. You can now sign in with your new PIN."
        />
      </motion.div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-gray-800 mb-4">Reset Your PIN</h3>

      {/* Step 1: Phone */}
      {step === 'phone' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-600 mb-4">
            Enter your phone number to receive an OTP
          </p>
          <FormInput
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={(value) => {
              setPhone(value);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
            }}
            placeholder="+251 9XX XXX XXXX"
            error={errors.phone}
          />
          <FormButton
            onClick={handlePhoneSubmit}
            loading={sending}
            disabled={sending}
            variant="primary"
          >
            Send OTP
          </FormButton>
        </motion.div>
      )}

      {/* Step 2: OTP */}
      {step === 'otp' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-600 mb-4">
            Enter the 6-digit OTP sent to {phone}
          </p>
          <FormInput
            label="One-Time Password (OTP)"
            type="text"
            value={otp}
            onChange={(value) => {
              const numericValue = value.replace(/\D/g, '').slice(0, 6);
              setOtp(numericValue);
              if (errors.otp) setErrors((prev) => ({ ...prev, otp: '' }));
            }}
            placeholder="000000"
            maxLength={6}
            error={errors.otp}
          />
          <FormButton
            onClick={handleOtpSubmit}
            loading={verifying}
            disabled={verifying}
            variant="primary"
          >
            Verify OTP
          </FormButton>
          <button
            type="button"
            onClick={() => setStep('phone')}
            className="text-sm text-[#0d7e4d] hover:underline w-full text-center"
          >
            ← Back to phone
          </button>
        </motion.div>
      )}

      {/* Step 3: New PIN */}
      {step === 'newpin' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <p className="text-sm text-gray-600 mb-4">Create a new 4-digit PIN</p>

          <FormInput
            label="New PIN"
            type="password"
            value={newPin}
            onChange={(value) => {
              const val = handlePinChange(value);
              setNewPin(val);
              if (errors.newPin) setErrors((prev) => ({ ...prev, newPin: '' }));
            }}
            placeholder="••••"
            maxLength={4}
            error={errors.newPin}
          />

          <FormInput
            label="Confirm PIN"
            type="password"
            value={confirmPin}
            onChange={(value) => {
              const val = handlePinChange(value);
              setConfirmPin(val);
              if (errors.confirmPin) setErrors((prev) => ({ ...prev, confirmPin: '' }));
            }}
            placeholder="••••"
            maxLength={4}
            error={errors.confirmPin}
          />

          <FormButton
            onClick={handleNewPinSubmit}
            loading={resetting}
            disabled={resetting}
            variant="primary"
          >
            Reset PIN
          </FormButton>

          <button
            type="button"
            onClick={() => setStep('otp')}
            className="text-sm text-[#0d7e4d] hover:underline w-full text-center"
          >
            ← Back to OTP
          </button>
        </motion.div>
      )}
    </div>
  );
}
