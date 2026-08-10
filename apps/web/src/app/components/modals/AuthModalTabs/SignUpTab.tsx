'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Language, defaultLanguage } from '@/i18n/config';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormSuccess from '@/app/components/forms/FormSuccess';
import { useAuth } from '@/app/context/AuthContext';
import { authAPI } from '@/app/services/api';

interface SignUpTabProps {
  lang?: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

export default function SignUpTab({ lang = defaultLanguage, onSuccess, onError }: SignUpTabProps) {
  const { signup, isLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '+2519',
    email: '',
    fayda: '',
    pin: '',
    otp: '',
  });
  const [fayda, setFayda] = useState({
    verified: false,
    loading: false,
    showOtpVerification: false,
    faydaOtp: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const handleFieldChange = (field: string, value: string) => {
    if (field === 'firstName' || field === 'lastName') {
      const hasInvalidChars = /[^a-zA-Z]/.test(value);

      if (hasInvalidChars) {
        setErrors((prev) => ({
          ...prev,
          [field]: 'This field should contain only characters'
        }));
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    } else if (field === 'phoneNumber') {
      const prefix = value.substring(0, 5);
      const isValidPrefix = prefix === '+2519' || prefix === '+2517';

      if (value.length >= 5 && !isValidPrefix) {
        setErrors((prev) => ({
          ...prev,
          [field]: 'Phone must start with +2519 or +2517'
        }));
      } else {
        const digitsAfterPrefix = value.substring(5).replace(/\D/g, '');

        if (digitsAfterPrefix.length > 8) {
          setErrors((prev) => ({
            ...prev,
            [field]: 'Only 8 digits allowed after +2519 or +2517'
          }));
          value = prefix + digitsAfterPrefix.slice(0, 8);
        } else {
          setErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field];
            return newErrors;
          });
        }
      }
    } else if (field === 'email') {
      const hasInvalidChars = /[^a-zA-Z0-9._@-]/.test(value);

      if (hasInvalidChars) {
        setErrors((prev) => ({
          ...prev,
          [field]: 'This field should contain only valid email characters'
        }));
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    } else if (field === 'fayda') {
      const hasInvalidChars = /[^0-9]/.test(value);

      if (hasInvalidChars) {
        setErrors((prev) => ({
          ...prev,
          [field]: 'This field should contain only numbers'
        }));
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }

      value = value.slice(0, 16);

      if (value.length === 16 && !fayda.verified && !fayda.showOtpVerification) {
        setFayda({ ...fayda, showOtpVerification: true, faydaOtp: '' });
      } else if (value.length < 16) {
        setFayda({ ...fayda, showOtpVerification: false, faydaOtp: '' });
      }
    } else if (field === 'otp') {
      const hasInvalidChars = /[^0-9]/.test(value);

      if (hasInvalidChars) {
        setErrors((prev) => ({
          ...prev,
          [field]: 'This field should contain only numbers'
        }));
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
      value = value.slice(0, 6);
    } else if (field === 'pin') {
      const hasInvalidChars = /[^0-9]/.test(value);

      if (hasInvalidChars) {
        setErrors((prev) => ({
          ...prev,
          [field]: 'This field should contain only numbers'
        }));
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
      value = value.slice(0, 4);
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name required';
    } else if (!/^[a-zA-Z]+$/.test(formData.firstName)) {
      newErrors.firstName = 'Only alphabetic characters allowed';
    } else if (formData.firstName.length < 2) {
      newErrors.firstName = 'Name must be at least 2 characters';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name required';
    } else if (!/^[a-zA-Z]+$/.test(formData.lastName)) {
      newErrors.lastName = 'Only alphabetic characters allowed';
    } else if (formData.lastName.length < 2) {
      newErrors.lastName = 'Name must be at least 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number required';
    } else if (!formData.phoneNumber.startsWith('+2519') && !formData.phoneNumber.startsWith('+2517')) {
      newErrors.phoneNumber = 'Phone must start with +2519 or +2517';
    } else {
      const phoneDigits = formData.phoneNumber.substring(5).replace(/\D/g, '');
      if (phoneDigits.length !== 8) {
        newErrors.phoneNumber = 'Phone must have exactly 8 digits after +2519 or +2517';
      }
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email required';
    } else if (!formData.email.toLowerCase().includes('@gmail.com')) {
      newErrors.email = 'Email must contain @gmail.com';
    } else if (!formData.email.match(/^[a-zA-Z0-9._]+@gmail\.com$/)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fayda.trim()) {
      newErrors.fayda = 'Fayda number required';
    } else if (formData.fayda.length !== 16) {
      newErrors.fayda = 'Fayda must be exactly 16 digits';
    } else if (!/^\d+$/.test(formData.fayda)) {
      newErrors.fayda = 'Fayda must contain only digits';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.otp.trim()) {
      newErrors.otp = 'OTP required';
    } else if (formData.otp.length !== 6) {
      newErrors.otp = 'OTP must be 6 digits';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep5 = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.pin.trim()) {
      newErrors.pin = 'PIN required';
    } else if (formData.pin.length !== 4) {
      newErrors.pin = 'PIN must be 4 digits';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerifyFayda = async () => {
    if (!formData.otp.trim()) {
      setErrors({ ...errors, otp: 'OTP required' });
      return;
    }
    if (formData.otp.length !== 6) {
      setErrors({ ...errors, otp: 'OTP must be 6 digits' });
      return;
    }

    setFayda({ ...fayda, loading: true });
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setFayda({ verified: true, loading: false, showOtpVerification: false, faydaOtp: '' });
      setErrors({});
    } catch (error) {
      setErrors({ ...errors, otp: 'OTP verification failed' });
      setFayda({ ...fayda, loading: false });
    }
  };

  const handleNext = () => {
    let isValid = false;
    if (step === 1) isValid = validateStep1();
    else if (step === 2) isValid = validateStep2();
    else if (step === 3) isValid = validateStep3();

    if (isValid) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    console.log('📢 handleSubmit called');
    console.log('formData.pin:', formData.pin);

    if (!validateStep5()) {
      console.log('❌ PIN validation failed');
      onError?.('Validation Error', 'Please enter a valid PIN');
      return;
    }

    console.log('✅ PIN validation passed');

    try {
      // Pre-check: is this email/phone already registered? Show a clear message
      // instead of submitting and relying on the backend 409.
      try {
        const availability = await authAPI.checkAvailability({
          email: formData.email,
          phoneNumber: formData.phoneNumber,
        });

        if (!availability.available) {
          const { email_taken, phone_taken } = availability;
          const field = email_taken && phone_taken
            ? 'email address or phone number'
            : email_taken
              ? 'email address'
              : 'phone number';

          onError?.(
            'Account Already Exists',
            `An account with this ${field} already exists. Please sign in instead, or use a different ${field}.`,
          );
          return;
        }
      } catch {
        // Pre-check is best-effort — if it fails, fall through and let the
        // backend's 409 Conflict surface the "already exists" error.
      }

      console.log('📤 Calling signup() with data:', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        fayda: formData.fayda,
      });

      await signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.pin,
        phoneNumber: formData.phoneNumber,
        fayda: formData.fayda,
      });

      console.log('✅ Signup successful!');
      setSuccessMessage('✓ Registration complete!');
      console.log('📢 Calling onSuccess callback...');
      onSuccess?.('🎉 Welcome to QalNet!', 'Your secure account is ready.', 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      console.error('❌ Signup error:', message);
      onError?.('Error', message);
    }
  };

  if (successMessage) {
    return <FormSuccess title="✓ Success" message={successMessage} />;
  }

  return (
    <div>
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex flex-col items-center flex-1">
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full font-bold text-sm transition-all mb-2 ${s <= step
                  ? 'bg-[#0d7e4d] text-white shadow-lg'
                  : 'bg-gray-200 text-gray-500'
                  }`}
              >
                {s < step ? '✓' : s}
              </div>
              <p className="text-xs text-gray-600 text-center">
                {s === 1 ? 'Personal' : s === 2 ? 'Contact' : s === 3 ? 'Fayda' : s === 4 ? 'OTP' : 'PIN'}
              </p>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#0d7e4d] h-full transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-800">
          {step === 1
            ? lang === 'en'
              ? 'Personal Information'
              : 'ስለራስዎ መግለጫ'
            : step === 2
              ? lang === 'en'
                ? 'Contact Information'
                : 'የእርስዎ ግንኙነት'
              : step === 3
                ? lang === 'en'
                  ? 'Fayda Number'
                  : 'Fayda ቁጥር'
                : step === 4
                  ? lang === 'en'
                    ? 'OTP Verification'
                    : 'OTP ማጣራት'
                  : lang === 'en'
                    ? 'Create Your PIN'
                    : 'PIN ይሰሩ'}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {lang === 'en' ? `Step ${step} of 5` : `ደረጃ ${step} ከ 5`}
        </p>
      </div>

      {/* Step 1: Personal Information */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-5"
        >
          <FormInput
            label={lang === 'en' ? '👤 First Name' : '👤 መጀመሪያ ስም'}
            type="text"
            value={formData.firstName}
            onChange={(value) => handleFieldChange('firstName', value)}
            placeholder="John"
            error={errors.firstName}
          />

          <FormInput
            label={lang === 'en' ? '👤 Last Name' : '👤 ስም'}
            type="text"
            value={formData.lastName}
            onChange={(value) => handleFieldChange('lastName', value)}
            placeholder="Doe"
            error={errors.lastName}
          />

          <button
            onClick={handleNext}
            className="w-full py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all duration-200 mt-8"
          >
            {lang === 'en' ? 'Next →' : 'ቀጥል →'}
          </button>
        </motion.div>
      )}

      {/* Step 2: Contact Information */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-5"
        >
          <FormInput
            label={lang === 'en' ? '📱 Phone Number' : '📱 ስልክ ቁጥር'}
            type="text"
            value={formData.phoneNumber}
            onChange={(value) => handleFieldChange('phoneNumber', value)}
            placeholder="+25191xxxxxxxx"
            error={errors.phoneNumber}
            hint={lang === 'en' ? '+2519 or +2517 followed by 8 digits' : '+2519 ወይም +2517 ከ 8 ዲጂት ጋር'}
          />

          <FormInput
            label={lang === 'en' ? '📧 Email Address' : '📧 ኢሜል'}
            type="email"
            value={formData.email}
            onChange={(value) => handleFieldChange('email', value)}
            placeholder="username@gmail.com"
            error={errors.email}
            hint={lang === 'en' ? 'Must contain @gmail.com' : '@gmail.com ያስፈልግ'}
          />

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 py-3 border-2 border-[#0d7e4d] text-[#0d7e4d] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all"
            >
              {lang === 'en' ? 'Next →' : 'ቀጥል →'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Fayda Identity Verification */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-5"
        >
          <FormInput
            label={lang === 'en' ? '🆔 Fayda Number' : '🆔 Fayda ቁጥር'}
            type="text"
            value={formData.fayda}
            onChange={(value) => handleFieldChange('fayda', value)}
            placeholder="1234567890123456"
            error={errors.fayda}
            hint={lang === 'en' ? '16 digits only' : '16 ዲጂት ብቻ'}
          />

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 py-3 border-2 border-[#0d7e4d] text-[#0d7e4d] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all"
            >
              {lang === 'en' ? 'Next →' : 'ቀጥል →'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 4: OTP Verification */}
      {step === 4 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-5"
        >
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              {lang === 'en'
                ? 'We sent a 6-digit OTP to your phone number'
                : 'ወደ ስልክ ቁጥርዎ 6-ዲጂት OTP ልኬላልክ'}
            </p>
          </div>

          <FormInput
            label={lang === 'en' ? '🔐 Enter OTP' : '🔐 OTP ገብአ'}
            type="text"
            value={formData.otp}
            onChange={(value) => handleFieldChange('otp', value)}
            placeholder="000000"
            maxLength={6}
            error={errors.otp}
            hint={lang === 'en' ? '6 digits' : '6 ዲጂት'}
          />

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 py-3 border-2 border-[#0d7e4d] text-[#0d7e4d] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={() => {
                if (validateStep4()) {
                  handleVerifyFayda();
                  setStep(step + 1);
                }
              }}
              className="flex-1 py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all"
            >
              {lang === 'en' ? 'Confirm →' : 'ያረጋግጡ →'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 5: Create PIN */}
      {step === 5 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-5"
        >
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              {lang === 'en'
                ? 'Create a 4-digit PIN for your account security'
                : 'ሂሳብ ደህንነት ለ 4-ዲጂት PIN ይሰሩ'}
            </p>
          </div>

          <FormInput
            label={lang === 'en' ? '🔐 Your PIN' : '🔐 PIN'}
            type="password"
            value={formData.pin}
            onChange={(value) => handleFieldChange('pin', value)}
            placeholder="••••"
            maxLength={4}
            error={errors.pin}
            hint={lang === 'en' ? '4 digits' : '4 ዲጂት'}
          />

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 py-3 border-2 border-[#0d7e4d] text-[#0d7e4d] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={() => {
                console.log('🔵 Create Account button clicked');
                console.log('PIN value:', formData.pin);
                console.log('PIN length:', formData.pin.length);
                handleSubmit();
              }}
              disabled={isLoading}
              className="flex-1 py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all disabled:opacity-50"
            >
              {isLoading
                ? '⏳ Creating...'
                : lang === 'en'
                  ? '🎉 Create Account'
                  : '🎉 ሂሳብ ይሰሩ'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
