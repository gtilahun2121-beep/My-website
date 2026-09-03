'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Language, defaultLanguage } from '@/i18n/config';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormSuccess from '@/app/components/forms/FormSuccess';
import { useAuth, TwoFactorRequiredError } from '@/app/context/AuthContext';
import { ValidationSchema } from '@/app/utils/validation';

interface SignInTabProps {
  lang?: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

export default function SignInTab({ lang = defaultLanguage, onSuccess, onError }: SignInTabProps) {
  const { signin, verify2FALogin, isLoading } = useAuth();
  const [formData, setFormData] = useState({ phoneNumber: '', pin: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');

  const handleFieldChange = (field: string, value: string) => {
    let finalValue = value;
    if (field === 'phoneNumber') {
      // Accept an email address OR a phone number as the sign-in identifier.
      // Phone numbers may carry a leading +, country code, spaces/dashes;
      // emails are passed through untouched.
      if (value.includes('@')) {
        finalValue = value;
      } else {
        // Cap phone length: +251 + 9 local digits = 13 chars
        const digitsOnly = value.replace(/[^\d+]/g, '');
        if (digitsOnly.replace(/\D/g, '').length > 12) {
          finalValue = '+' + digitsOnly.replace(/\D/g, '').substring(0, 12);
        } else {
          finalValue = value;
        }
      }
    } else if (field === 'pin') {
      finalValue = value.replace(/\D/g, '').slice(0, 6);
    }
    setFormData((prev) => ({ ...prev, [field]: finalValue }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const identifier = formData.phoneNumber.trim();
    if (!identifier) {
      newErrors.phoneNumber = 'Email or phone number is required';
    } else {
      const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      if (looksLikeEmail) {
        const emailValidation = ValidationSchema.validateEmail(identifier);
        if (!emailValidation.valid) newErrors.phoneNumber = emailValidation.error || 'Invalid email';
      } else {
        const phoneValidation = ValidationSchema.validatePhone(identifier);
        if (!phoneValidation.valid) {
          newErrors.phoneNumber = 'Enter a valid email or Ethiopian phone number';
        }
      }
    }

    if (!formData.pin) {
      newErrors.pin = 'PIN is required';
    } else if (!/^\d{4,6}$/.test(formData.pin)) {
      newErrors.pin = 'PIN must be 4-6 digits';
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
      if (error instanceof TwoFactorRequiredError) {
        setMfaToken(error.mfaToken);
        setOtpCode('');
        setTwoFactorError('');
        onSuccess?.('Two-Factor Authentication', 'Enter the code from your authenticator app', 3000);
        return;
      }
      const message = error instanceof Error ? error.message : 'Sign in failed';
      
      // Check if user not found - suggest signup
      if (message.includes('not found') || message.includes('404')) {
        onError?.('User Not Found', 'This phone number is not registered. Please sign up first.', 5000);
      } else if (message.includes('PIN') || message.includes('credentials')) {
        onError?.('Invalid PIN', 'The PIN you entered is incorrect. Please try again.', 3000);
      } else {
        onError?.('Error', message);
      }
    }
  };

  const handle2FASubmit = async () => {
    setTwoFactorError('');
    const code = otpCode.trim();
    if (code.length < 6 || code.length > 20) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app, or a backup code');
      return;
    }
    setTwoFactorLoading(true);
    try {
      if (!mfaToken) throw new Error('Missing MFA token');
      await verify2FALogin(mfaToken, code);
      setSuccessMessage('✓ Signed in successfully!');
      onSuccess?.('Sign In Successful', 'Welcome back to QalNet!', 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      setTwoFactorError(message);
    } finally {
      setTwoFactorLoading(false);
    }
  };

  if (successMessage) {
    return <FormSuccess title="✓ Welcome Back" message={successMessage} />;
  }

  if (mfaToken) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[#00d9ff] mb-4">
          {lang === 'en' ? 'Two-Factor Authentication' : lang === 'am' ? 'የሁለት-ደረጃ ማረጋገጫ' : 'Iggantoota Lama'} 
        </h3>

        <FormInput
          label={lang === 'en' ? 'Authentication Code' : lang === 'am' ? 'የማረጋገጫ ኮድ' : 'Koodii Mirkaneessaa'}
          type="text"
          value={otpCode}
          onChange={(value) => setOtpCode(value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 20))}
          placeholder="000000"
          error={twoFactorError}
        />

        <FormButton
          onClick={handle2FASubmit}
          loading={twoFactorLoading}
          disabled={twoFactorLoading}
          variant="primary"
        >
          {twoFactorLoading ? '⏳ Verifying...' : lang === 'en' ? 'Verify & Sign In' : lang === 'am' ? 'አረጋግጥ እና ግባ' : 'Mirkaneessi & Seeni'}
        </FormButton>

        <button
          type="button"
          onClick={() => setMfaToken(null)}
          className="w-full text-xs text-gray-500 text-center hover:text-[#00d9ff]"
        >
          ← Back to PIN
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-[#00d9ff] mb-4">
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
        label={lang === 'en' ? '6-Digit PIN' : lang === 'am' ? '6-ዲጂት ፒን' : lang === 'om' ? '6-Digit PIN' : '6-Digit PIN'}
        type="password"
        value={formData.pin}
        onChange={(value) => handleFieldChange('pin', value)}
        placeholder="••••"
        maxLength={6}
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
