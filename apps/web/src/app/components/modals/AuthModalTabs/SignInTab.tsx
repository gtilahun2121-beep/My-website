'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Language, defaultLanguage } from '@/i18n/config';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormSuccess from '@/app/components/forms/FormSuccess';
import { useAuth } from '@/app/context/AuthContext';
import { ValidationSchema } from '@/app/utils/validation';

interface SignInTabProps {
  lang?: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

export default function SignInTab({ lang = defaultLanguage, onSuccess, onError }: SignInTabProps) {
  const { signin, isLoading } = useAuth();
  const [formData, setFormData] = useState({ phoneNumber: '+2519', pin: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const handleFieldChange = (field: string, value: string) => {
    let finalValue = value;
    if (field === 'phoneNumber') {
      // Keep +2519 prefix
      if (!value.startsWith('+2519')) {
        value = '+2519';
      }
      // Allow only digits after +2519
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly.length > 10) {
        value = '+' + digitsOnly.substring(0, 10);
      }
      finalValue = value;
    } else if (field === 'pin') {
      finalValue = value.replace(/\D/g, '').slice(0, 4);
    }
    setFormData((prev) => ({ ...prev, [field]: finalValue }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else {
      const validation = ValidationSchema.validatePhone(formData.phoneNumber);
      if (!validation.valid) newErrors.phoneNumber = validation.error || 'Invalid phone';
    }

    if (!formData.pin) {
      newErrors.pin = 'PIN is required';
    } else if (formData.pin.length !== 4) {
      newErrors.pin = 'PIN must be 4 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    try {
      if (!validateForm()) {
        onError?.('Validation Error', 'Please check your phone and PIN');
        return;
      }

      await signin(formData.phoneNumber, formData.pin);
      setSuccessMessage('✓ Signed in successfully!');
      onSuccess?.('Sign In Successful', 'Welcome back to QalNet!', 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      onError?.('Error', message);
    }
  };

  if (successMessage) {
    return <FormSuccess title="✓ Welcome Back" message={successMessage} />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">
        {lang === 'en' ? 'Sign In to Your Account' : lang === 'am' ? 'ወደ መስተዋወቅ ወደ ውስጥ ግባ' : lang === 'om' ? 'Seensa Akkauntaa Keessan' : 'Seensa Akkauntaa Keessan'}
      </h3>

      <FormInput
        label={lang === 'en' ? 'Phone Number' : lang === 'am' ? 'ስልክ ቁጥር' : lang === 'om' ? 'Lakkoofsa Bilbilaa' : 'Lakkoofsa Bilbilaa'}
        type="tel"
        value={formData.phoneNumber}
        onChange={(value) => handleFieldChange('phoneNumber', value)}
        placeholder="+2519 xxxxxxxx"
        error={errors.phoneNumber}
      />

      <FormInput
        label={lang === 'en' ? '4-Digit PIN' : lang === 'am' ? '4-ዲጂት ፒን' : lang === 'om' ? '4-Digit PIN' : '4-Digit PIN'}
        type="password"
        value={formData.pin}
        onChange={(value) => handleFieldChange('pin', value)}
        placeholder="••••"
        maxLength={4}
        error={errors.pin}
      />

      <FormButton
        onClick={handleSubmit}
        loading={isLoading}
        disabled={isLoading}
        variant="primary"
      >
        {isLoading ? '⏳ Processing...' : lang === 'en' ? 'Sign In' : lang === 'am' ? 'ወደ ውስጥ ግባ' : 'Seensa'}
      </FormButton>

      <p className="text-xs text-gray-500 text-center">
        {lang === 'en' ? "Don't have an account? Click the \"Sign Up\" tab" : lang === 'am' ? 'መስተዋወቅ እንደሌገደበ? \"ምዝገባ\" tab ን ጠቅ ያድርጉ' : 'Akkaunt hin qabaatu? \"Galmaa\" tab keessatti cuqaasi'}
      </p>
    </div>
  );
}
