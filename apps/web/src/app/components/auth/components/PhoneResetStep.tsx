'use client';

import { motion } from 'framer-motion';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';
import ValidationSchema from '@/app/utils/validation';

interface PhoneResetStepProps {
  phoneNumber: string;
  onPhoneChange: (phone: string) => void;
  onContinue: () => void;
  loading: boolean;
  error?: string;
  onErrorDismiss?: () => void;
}

export default function PhoneResetStep({
  phoneNumber,
  onPhoneChange,
  onContinue,
  loading,
  error,
  onErrorDismiss,
}: PhoneResetStepProps) {
  const validation = ValidationSchema.validatePhone(phoneNumber);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
          🔐 Reset Access Code
        </h3>
        <p className="text-center text-sm text-gray-600 mb-4">
          Enter your phone number to receive a verification code
        </p>
      </div>

      <FormInput
        label="Phone Number"
        type="tel"
        placeholder="+251911223344"
        value={phoneNumber}
        onChange={onPhoneChange}
        icon="📱"
        hint="Same number you used to register"
      />

      {error && <FormError message={error} onDismiss={onErrorDismiss} />}

      <FormButton
        onClick={onContinue}
        disabled={!validation.valid || loading}
        loading={loading}
        variant="danger"
        icon="📨"
      >
        Send Verification Code
      </FormButton>
    </motion.div>
  );
}
