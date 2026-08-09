'use client';

import { motion } from 'framer-motion';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';
import ValidationSchema from '@/app/utils/validation';

interface NewPinStepProps {
  newPin: string;
  confirmPin: string;
  onNewPinChange: (pin: string) => void;
  onConfirmPinChange: (pin: string) => void;
  onReset: () => void;
  onBack: () => void;
  loading: boolean;
  error?: string;
  onErrorDismiss?: () => void;
}

export default function NewPinStep({
  newPin,
  confirmPin,
  onNewPinChange,
  onConfirmPinChange,
  onReset,
  onBack,
  loading,
  error,
  onErrorDismiss,
}: NewPinStepProps) {
  const pinValidation = ValidationSchema.validatePin(newPin);
  const confirmValidation = ValidationSchema.validatePinConfirmation(newPin, confirmPin);

  const isValid = pinValidation.valid && confirmValidation.valid;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
          🔑 Create New Access Code
        </h3>
        <p className="text-center text-sm text-gray-600 mb-4">
          Set a new 4-digit PIN to secure your account
        </p>
      </div>

      <FormInput
        label="New 4-Digit PIN"
        type="password"
        placeholder="••••"
        value={newPin}
        onChange={(val) => onNewPinChange(val.replace(/\D/g, ''))}
        maxLength={4}
        icon="🔐"
        hint="You'll use this to sign in"
        error={!pinValidation.valid && newPin ? pinValidation.error : undefined}
      />

      <FormInput
        label="Confirm PIN"
        type="password"
        placeholder="••••"
        value={confirmPin}
        onChange={(val) => onConfirmPinChange(val.replace(/\D/g, ''))}
        maxLength={4}
        icon="🔑"
        hint="Must match the new PIN above"
        error={!confirmValidation.valid && confirmPin ? confirmValidation.error : undefined}
      />

      {error && <FormError message={error} onDismiss={onErrorDismiss} />}

      <FormButton
        onClick={onReset}
        disabled={!isValid || loading}
        loading={loading}
        variant="danger"
        icon="✓"
      >
        Reset PIN
      </FormButton>

      <FormButton onClick={onBack} disabled={loading} variant="secondary">
        ← Back
      </FormButton>
    </motion.div>
  );
}
