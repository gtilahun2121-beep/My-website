'use client';

import { motion } from 'framer-motion';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';
import ValidationSchema from '@/app/utils/validation';

interface DetailsEntryStepProps {
  fullName: string;
  pin: string;
  confirmPin: string;
  faydaNumber: string;
  onFullNameChange: (name: string) => void;
  onPinChange: (pin: string) => void;
  onConfirmPinChange: (pin: string) => void;
  onFaydaChange: (fayda: string) => void;
  onComplete: () => void;
  onBack: () => void;
  loading: boolean;
  error?: string;
  onErrorDismiss?: () => void;
}

export default function DetailsEntryStep({
  fullName,
  pin,
  confirmPin,
  faydaNumber,
  onFullNameChange,
  onPinChange,
  onConfirmPinChange,
  onFaydaChange,
  onComplete,
  onBack,
  loading,
  error,
  onErrorDismiss,
}: DetailsEntryStepProps) {
  const nameValidation = ValidationSchema.validateFullName(fullName);
  const pinValidation = ValidationSchema.validatePin(pin);
  const confirmValidation = ValidationSchema.validatePinConfirmation(pin, confirmPin);
  const faydaValidation = ValidationSchema.validateFaydaNumber(faydaNumber);

  const isValid =
    nameValidation.valid &&
    pinValidation.valid &&
    confirmValidation.valid &&
    faydaValidation.valid;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div>
        <h3 className="text-2xl font-black text-[#0d7e4d] mb-2 text-center">
          ✍️ Your Details
        </h3>
        <p className="text-center text-sm text-gray-600 mb-4">
          Complete your account information
        </p>
      </div>

      <FormInput
        label="Full Name"
        type="text"
        placeholder="Aisha Mohammed"
        value={fullName}
        onChange={onFullNameChange}
        icon="👤"
        hint="Your legal name"
        error={!nameValidation.valid && fullName ? nameValidation.error : undefined}
      />

      <FormInput
        label="4-Digit Security PIN"
        type="password"
        placeholder="••••"
        value={pin}
        onChange={(val) => onPinChange(val.replace(/\D/g, ''))}
        maxLength={4}
        icon="🔐"
        hint="You'll use this to log in"
        error={!pinValidation.valid && pin ? pinValidation.error : undefined}
      />

      <FormInput
        label="Confirm PIN"
        type="password"
        placeholder="••••"
        value={confirmPin}
        onChange={(val) => onConfirmPinChange(val.replace(/\D/g, ''))}
        maxLength={4}
        icon="🔑"
        hint="Must match your PIN above"
        error={!confirmValidation.valid && confirmPin ? confirmValidation.error : undefined}
      />

      <FormInput
        label="Fayda Number"
        type="text"
        placeholder="123456789"
        value={faydaNumber}
        onChange={onFaydaChange}
        icon="🎫"
        hint="Your unique member ID (6-12 digits)"
        error={!faydaValidation.valid && faydaNumber ? faydaValidation.error : undefined}
      />

      {error && <FormError message={error} onDismiss={onErrorDismiss} />}

      <FormButton
        onClick={onComplete}
        disabled={!isValid || loading}
        loading={loading}
        icon="✓"
      >
        Complete Registration
      </FormButton>

      <FormButton onClick={onBack} disabled={loading} variant="secondary">
        ← Back
      </FormButton>
    </motion.div>
  );
}
