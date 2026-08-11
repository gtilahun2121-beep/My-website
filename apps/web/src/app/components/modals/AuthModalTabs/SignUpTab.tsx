'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Language, defaultLanguage } from '@/i18n/config';
import FormInput from '@/app/components/forms/FormInput';
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
    otp: '',
    pin: '',
  });
  const [fayda, setFayda] = useState({
    verified: false,
    loading: false,
  });
  const [otp, setOtp] = useState({
    sent: false,
    sending: false,
    verifying: false,
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
      setFayda((prev) => ({ ...prev, verified: false }));
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
      newErrors.otp = 'OTP must be exactly 6 digits';
    } else if (!/^\d+$/.test(formData.otp)) {
      newErrors.otp = 'OTP must contain only digits';
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
    if (!validateStep3()) return;

    setFayda((prev) => ({ ...prev, loading: true }));
    try {
      // Real verification against POST /api/v1/auth/verify-fayda
      const res = await authAPI.verifyFayda(formData.fayda);
      if (!res.verified) {
        setErrors({ fayda: 'This Fayda ID is already registered to another account.' });
        setFayda((prev) => ({ ...prev, loading: false }));
        return;
      }
      setFayda((prev) => ({ ...prev, verified: true, loading: false }));

      // Send an OTP to the phone so the next step can verify it.
      setOtp((prev) => ({ ...prev, sending: true }));
      try {
        await authAPI.sendOtp(formData.phoneNumber);
        setOtp({ sent: true, sending: false, verifying: false });
        setErrors({});
        setStep(4);
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : 'Failed to send OTP';
        setErrors({ fayda: message });
        setOtp((prev) => ({ ...prev, sending: false }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fayda verification failed';
      setErrors({ fayda: message });
      setFayda((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleVerifyOtp = async () => {
    if (!validateStep4()) return;

    setOtp((prev) => ({ ...prev, verifying: true }));
    try {
      const res = await authAPI.verifyOTP(formData.phoneNumber, formData.otp);
      if (!res.verified) {
        setErrors({ otp: 'Invalid or expired OTP. Please check the code and try again.' });
        setOtp((prev) => ({ ...prev, verifying: false }));
        return;
      }
      setOtp((prev) => ({ ...prev, verifying: false }));
      setErrors({});
      setStep(5);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OTP verification failed';
      setErrors({ otp: message });
      setOtp((prev) => ({ ...prev, verifying: false }));
    }
  };

  const handleResendOtp = async () => {
    setOtp((prev) => ({ ...prev, sending: true }));
    try {
      await authAPI.sendOtp(formData.phoneNumber);
      setOtp((prev) => ({ ...prev, sent: true, sending: false }));
      setErrors({});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend OTP';
      setErrors({ otp: message });
      setOtp((prev) => ({ ...prev, sending: false }));
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
    if (!validateStep5()) {
      onError?.('Validation Error', 'Please enter a valid PIN');
      return;
    }

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

      await signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.pin,
        phoneNumber: formData.phoneNumber,
        fayda: formData.fayda,
      });

      setSuccessMessage('✓ Registration complete!');
      onSuccess?.('🎉 Welcome to QalNet!', 'Your secure account is ready.', 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
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
                  ? 'bg-[#314fa0] text-white shadow-lg'
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
            className="bg-[#314fa0] h-full transition-all duration-300"
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
                    ? 'Verify Your Phone'
                    : 'ስልክዎን ያረጋግጡ'
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
            className="w-full py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all duration-200 mt-8"
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
              className="flex-1 py-3 border-2 border-[#314fa0] text-[#314fa0] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all"
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

          {fayda.verified && (
            <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-2">
              ✓ Fayda ID verified
            </p>
          )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 py-3 border-2 border-[#314fa0] text-[#314fa0] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleVerifyFayda}
              disabled={fayda.loading || otp.sending}
              className="flex-1 py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all disabled:opacity-50"
            >
              {fayda.loading || otp.sending
                ? lang === 'en'
                  ? '⏳ Verifying...'
                  : '⏳ በመመስረት ላይ...'
                : lang === 'en'
                  ? 'Verify & Send Code →'
                  : 'ያረጋግጡ እና ኮድ ይላኩ →'}
            </button>
          </div>

          {otp.sent && (
            <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              {lang === 'en'
                ? `A 6-digit code was sent to ${formData.phoneNumber}.`
                : `6-አሃዝ ኮድ ወደ ${formData.phoneNumber} ተልኳል።`}
            </p>
          )}
        </motion.div>
      )}

      {/* Step 4: Phone OTP Verification */}
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
                ? `Enter the 6-digit code sent to ${formData.phoneNumber}.`
                : `ወደ ${formData.phoneNumber} የተላከውን 6-አሃዝ ኮድ ያስገቡ።`}
            </p>
          </div>

          {/* Temporary universal dev OTP — shown until government SMS approval */}
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
            <p className="text-xs text-amber-900 font-semibold">
              {lang === 'en'
                ? '🟡 Testing only: enter code 818959 for any phone number (valid until SMS delivery is approved).'
                : '🟡 ለሙከራ ብቻ፡ የ SMS ፍቃድ እስኪገኝ ድረስ ለማንኛውም የስልክ ቁጥር ኮድ 818959 ያስገቡ።'}
            </p>
          </div>

          <FormInput
            label={lang === 'en' ? '🔢 Verification Code' : '🔢 ማረጋገጫ ኮድ'}
            type="text"
            value={formData.otp}
            onChange={(value) => handleFieldChange('otp', value)}
            placeholder="123456"
            maxLength={6}
            error={errors.otp}
            hint={lang === 'en' ? '6 digits' : '6 አሃዝ'}
          />

          <button
            onClick={handleResendOtp}
            disabled={otp.sending}
            className="w-full text-sm text-[#314fa0] font-semibold underline hover:text-[#2a4183] transition-all disabled:opacity-50"
          >
            {otp.sending
              ? lang === 'en'
                ? '⏳ Resending...'
                : '⏳ እየተላከ ነው...'
              : lang === 'en'
                ? 'Resend code'
                : 'ኮድ እንደገና ይላኩ'}
          </button>

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 py-3 border-2 border-[#314fa0] text-[#314fa0] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleVerifyOtp}
              disabled={otp.verifying}
              className="flex-1 py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all disabled:opacity-50"
            >
              {otp.verifying
                ? lang === 'en'
                  ? '⏳ Verifying...'
                  : '⏳ በመመስረት ላይ...'
                : lang === 'en'
                  ? 'Verify Code →'
                  : 'ኮድ ያረጋግጡ →'}
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
              className="flex-1 py-3 border-2 border-[#314fa0] text-[#314fa0] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all disabled:opacity-50"
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
