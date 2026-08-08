'use client';

import { motion } from 'framer-motion';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';
import ValidationSchema from '@/app/utils/validation';

interface PhoneVerificationStepProps {
  phoneNumber: string;
  onPhoneChange: (phone: string) => void;
  onContinue: () => void;
  loading: boolean;
  error?: string;
  onErrorDismiss?: () => void;
}

export default function PhoneVerificationStep({
  phoneNumber,
  onPhoneChange,
  onContinue,
  loading,
  error,
  onErrorDismiss,
}: PhoneVerificationStepProps) {
  const validation = ValidationSchema.validatePhone(phoneNumber);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-[#0d7e4d] mb-2 text-center">📱 Your Phone</h3>
        <p className="text-center text-sm text-gray-600 mb-4">
          We'll send a verification code to this number
        </p>
      </div>

      <FormInput
        label="Phone Number"
        type="tel"
        placeholder="+251911223344"
        value={phoneNumber}
        onChange={onPhoneChange}
        icon="📱"
        hint="Use the same number you'll use to log in"
      />

      {error && <FormError message={error} onDismiss={onErrorDismiss} />}

      <FormButton
        onClick={onContinue}
        disabled={!validation.valid || loading}
        loading={loading}
        icon="📨"
      >
        Send Verification Code
      </FormButton>
    </motion.div>
  );
}
