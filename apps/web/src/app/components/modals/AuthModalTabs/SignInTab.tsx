'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Language, defaultLanguage } from '@/i18n/config';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormSuccess from '@/app/components/forms/FormSuccess';
import { useAuth, TwoFactorRequiredError } from '@/app/context/AuthContext';
import { homePathForStoredUser } from '@/app/lib/roleHome';
import { ValidationSchema } from '@/app/utils/validation';

interface SignInTabProps {
  lang?: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

export default function SignInTab({ lang = defaultLanguage, onSuccess, onError }: SignInTabProps) {
  const { signin, verify2FALogin, isLoading } = useAuth();
  const router = useRouter();
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
      // More robust email detection: must contain @
      const looksLikeEmail = identifier.includes('@');
      if (looksLikeEmail) {
        const emailValidation = ValidationSchema.validateEmail(identifier);
        if (!emailValidation.valid) {
          newErrors.phoneNumber = emailValidation.error || 'Invalid email address';
        }
      } else {
        // Treat as phone number
        const phoneValidation = ValidationSchema.validatePhone(identifier);
        if (!phoneValidation.valid) {
          newErrors.phoneNumber = phoneValidation.error || 'Enter a valid Ethiopian phone number (e.g., +2519xxxxxxxx or 09xxxxxxxx)';
        }
      }
    }

    if (!formData.pin) {
      newErrors.pin = 'PIN is required';
    } else if (formData.pin.length < 4) {
      newErrors.pin = 'PIN must be at least 4 digits';
    } else if (formData.pin.length > 6) {
      newErrors.pin = 'PIN cannot exceed 6 digits';
    } else if (!/^\d+$/.test(formData.pin)) {
      newErrors.pin = 'PIN must contain only digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    try {
      if (!validateForm()) {
        onError?.('Validation Error', 'Please check your email/phone and PIN');
        return;
      }

      await signin(formData.phoneNumber, formData.pin);
      setSuccessMessage('✓ Signed in successfully!');
      onSuccess?.('Sign In Successful', 'Welcome back to QalNet!', 3000);
      router.push(homePathForStoredUser());
    } catch (error) {
      if (error instanceof TwoFactorRequiredError) {
        setMfaToken(error.mfaToken);
        setOtpCode('');
        setTwoFactorError('');
        onSuccess?.('Two-Factor Authentication Required', 'Enter the code from your authenticator app', 4000);
        return;
      }
      const message = error instanceof Error ? error.message : 'Sign in failed';
      
      // Parse error messages and provide actionable feedback
      if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('404')) {
        onError?.('User Not Found', 'This phone number or email is not registered. Please sign up first.', 5000);
        setErrors({ phoneNumber: 'User not found' });
      } else if (message.toLowerCase().includes('pin') || message.toLowerCase().includes('credentials')) {
        onError?.('Invalid PIN', 'The PIN you entered is incorrect. Please try again.', 3000);
        setErrors({ pin: 'Incorrect PIN' });
      } else if (message.toLowerCase().includes('disabled')) {
        onError?.('Account Disabled', 'Your account has been disabled. Contact support for assistance.', 5000);
      } else if (message.toLowerCase().includes('locked')) {
        onError?.('Account Locked', 'Too many failed attempts. Please try again later.', 5000);
      } else {
        onError?.('Sign In Failed', message, 4000);
      }
    }
  };

  const handle2FASubmit = async () => {
    setTwoFactorError('');
    const code = otpCode.trim();
    
    // Validate code length - accept TOTP (6 digits) or backup codes (longer)
    if (!code) {
      setTwoFactorError('Please enter your authentication code');
      return;
    }
    
    if (code.length < 6) {
      setTwoFactorError('Code must be at least 6 characters');
      return;
    }
    
    if (code.length > 20) {
      setTwoFactorError('Code is too long');
      return;
    }
    
    setTwoFactorLoading(true);
    try {
      if (!mfaToken) throw new Error('Missing MFA token - please try signing in again');
      await verify2FALogin(mfaToken, code);
      setSuccessMessage('✓ Signed in successfully!');
      onSuccess?.('Sign In Successful', 'Welcome back to QalNet!', 3000);
      router.push(homePathForStoredUser());
    } catch (error) {
      const message = error instanceof Error ? error.message : '2FA verification failed';
      if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('incorrect')) {
        setTwoFactorError('Invalid code. Please try again or use a backup code.');
      } else if (message.toLowerCase().includes('expired')) {
        setTwoFactorError('Code expired. Please sign in again.');
      } else {
        setTwoFactorError(message);
      }
    } finally {
      setTwoFactorLoading(false);
    }
  };

  if (successMessage) {
    return <FormSuccess title="✓ Welcome Back" message={successMessage} />;
  }

  if (mfaToken) {
    return (
      <div className="space-y-3 md:space-y-4">
        <h3 className="text-base md:text-lg font-bold text-[#0066ff] mb-3 md:mb-4">
          {lang === 'en' ? 'Two-Factor Authentication' : lang === 'am' ? 'የሁለት-ደረጃ ማረጋገጫ' : 'Iggantoota Lama'} 
        </h3>

        <FormInput
          label={lang === 'en' ? 'Authentication Code' : lang === 'am' ? 'የማረጋገጫ ኮድ' : 'Koodii Mirkaneessaa'}
          type="text"
          value={otpCode}
          onChange={(value) => setOtpCode(value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 20))}
          placeholder={lang === 'en' ? 'Enter 6-digit code or backup code' : 'Koodii seensuu'}
          error={twoFactorError}
          hint={lang === 'en' ? 'Enter the 6-digit code from your authenticator app' : undefined}
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
          onClick={() => {
            setMfaToken(null);
            setOtpCode('');
            setTwoFactorError('');
          }}
          className="w-full text-xs md:text-sm text-gray-500 text-center hover:text-[#0066ff] transition-colors py-2"
        >
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      <h3 className="text-base md:text-lg font-bold text-[#0066ff] mb-3 md:mb-4">
        {lang === 'en' ? 'Sign In to Your Account' : lang === 'am' ? 'ወደ መስተዋወቅ ወደ ውስጥ ግባ' : lang === 'om' ? 'Seensa Akkauntaa Keessan' : 'Seensa Akkauntaa Keessan'}
      </h3>

      <FormInput
        label={lang === 'en' ? 'Phone Number or Email' : lang === 'am' ? 'ስልክ ቁጥር ወይም ኢሜይል' : lang === 'om' ? 'Lakkoofsa Bilbilaa ykn Iimaalii' : 'Lakkoofsa Bilbilaa ykn Iimaalii'}
        type="tel"
        value={formData.phoneNumber}
        onChange={(value) => handleFieldChange('phoneNumber', value)}
        placeholder={lang === 'en' ? '+2519xxxxxxxx or email@domain.com' : '+2519xxxxxxxx'}
        error={errors.phoneNumber}
        hint={lang === 'en' ? 'Enter your phone number or email address' : undefined}
      />

      <FormInput
        label={lang === 'en' ? '6-Digit PIN' : lang === 'am' ? '6-ዲጂት ፒን' : lang === 'om' ? '6-Digit PIN' : '6-Digit PIN'}
        type="password"
        value={formData.pin}
        onChange={(value) => handleFieldChange('pin', value)}
        placeholder="••••"
        maxLength={6}
        error={errors.pin}
        hint={lang === 'en' ? 'Your security PIN (4-6 digits)' : undefined}
      />

      <FormButton
        onClick={handleSubmit}
        loading={isLoading}
        disabled={isLoading}
        variant="primary"
      >
        {isLoading ? '⏳ Processing...' : lang === 'en' ? 'Sign In' : lang === 'am' ? 'ወደ ውስጥ ግባ' : 'Seensa'}
      </FormButton>

      <p className="text-xs md:text-sm text-gray-500 text-center pt-2">
        {lang === 'en' ? "Don't have an account? Click the \"Sign Up\" tab" : lang === 'am' ? 'መስተዋወቅ እንደሌገደበ? \"ምዝገባ\" tab ን ጠቅ ያድርጉ' : 'Akkaunt hin qabaatu? \"Galmaa\" tab keessatti cuqaasi'}
      </p>
    </div>
  );
}
