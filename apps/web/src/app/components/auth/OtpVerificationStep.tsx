'use client';

import { motion } from 'framer-motion';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';
import ValidationSchema from '@/app/utils/validation';

interface OtpVerificationStepProps {
  otp: string;
  onOtpChange: (otp: string) => void;
  onVerify: () => void;
  onBack: () => void;
  loading: boolean;
  error?: string;
  onErrorDismiss?: () => void;
}

export default function OtpVerificationStep({
  otp,
  onOtpChange,
  onVerify,
  onBack,
  loading,
  error,
  onErrorDismiss,
}: OtpVerificationStepProps) {
  const validation = ValidationSchema.validateOtp(otp);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-[#0d7e4d] mb-2 text-center">✉️ Verify Code</h3>
        <p className="text-center text-sm text-gray-600 mb-4">
          Enter the 6-digit code sent to your phone
        </p>
      </div>

      <FormInput
        label="Verification Code"
        type="text"
        placeholder="000000"
        value={otp}
        onChange={(val) => onOtpChange(val.replace(/\D/g, ''))}
        maxLength={6}
        icon="🔐"
        hint="Demo: Enter any 6-digit code"
      />

      {error && <FormError message={error} onDismiss={onErrorDismiss} />}

      <FormButton
        onClick={onVerify}
        disabled={!validation.valid || loading}
        loading={loading}
        icon="✓"
      >
        Verify Code
      </FormButton>

      <FormButton onClick={onBack} disabled={loading} variant="secondary">
        ← Back
      </FormButton>
    </motion.div>
  );
}
