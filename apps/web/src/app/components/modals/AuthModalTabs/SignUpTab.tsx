'use client';

import { useEffect, useState } from 'react';
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

/**
 * Identity we carry back from the real Fayda (eSignet) page. The phone has
 * already been verified by a real Fayda-delivered OTP, so the signup skips the
 * SMS OTP step and jumps straight to the PIN step.
 */
interface FaydaResume {
  first: string;
  last: string;
  phone: string;
  fayda: string;
}

const readFaydaResume = (): FaydaResume | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('fayda') !== 'verified') return null;
  const name = params.get('name') ?? '';
  const [first = '', ...rest] = name.trim().split(/\s+/);
  let savedFayda = '';
  try {
    savedFayda = JSON.parse(window.sessionStorage.getItem('faydaSignup') ?? '{}').fayda ?? '';
  } catch {
    // malformed saved payload → fall back to whatever the form already has
  }
  return {
    first,
    last: rest.join(' '),
    phone: params.get('phone') ?? '',
    fayda: savedFayda,
  };
};

export default function SignUpTab({ lang = defaultLanguage, onSuccess, onError }: SignUpTabProps) {
  const { signup, isLoading } = useAuth();
  const [resume] = useState(readFaydaResume);
  const [step, setStep] = useState(() => (resume ? 5 : 1));
  const [formData, setFormData] = useState(() => ({
    firstName: resume?.first ?? '',
    lastName: resume?.last ?? '',
    phoneNumber: resume?.phone || '+2519',
    email: '',
    fayda: resume?.fayda ?? '',
    otp: '',
    pin: '',
  }));
  const [fayda, setFayda] = useState(() => ({
    verified: !!resume,
    loading: false,
  }));
  const [otp, setOtp] = useState({
    sent: false,
    sending: false,
    verifying: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [faydaOidc, setFaydaOidc] = useState({ starting: false });

  const handleSignInWithFayda = async () => {
    setFaydaOidc({ starting: true });
    try {
      const res = await authAPI.faydaInitiate();
      window.sessionStorage.setItem('faydaOidcState', res.state);
      window.location.href = res.authUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fayda sign-in failed';
      setErrors({ fayda: message });
      setFaydaOidc({ starting: false });
    }
  };

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
      value = value.slice(0, 6);
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
    } else if (formData.pin.length !== 6) {
      newErrors.pin = 'PIN must be 6 digits';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleVerifyFayda = async () => {
    if (!validateStep3()) return;

    setFayda((prev) => ({ ...prev, loading: true }));
    try {
      // Real registration check against POST /api/v1/auth/verify-fayda
      const res = await authAPI.verifyFayda(formData.fayda);
      if (!res.verified) {
        setErrors({ fayda: 'This Fayda ID is already registered to another account.' });
        setFayda((prev) => ({ ...prev, loading: false }));
        return;
      }
      setFayda((prev) => ({ ...prev, verified: true, loading: false }));

      // If the real Fayda eSignet integration is configured, send the user to
      // the real Fayda page — Fayda itself delivers the OTP to their phone.
      const cfg = await authAPI.faydaStatus();
      if (cfg.configured) {
        const { authUrl, state } = await authAPI.faydaInitiate();
        window.sessionStorage.setItem(
          'faydaSignup',
          JSON.stringify({ fayda: formData.fayda, state }),
        );
        window.location.href = authUrl;
        return;
      }

      // Not configured yet: fall back to the SMS OTP path (dev code 818959).
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

  // The resume identity is applied lazily from the mount-time state — the form
  // already opened at the PIN step (step 5) with the Fayda-verified data. This
  // effect only scrubs the URL/session so a reload doesn't re-trigger anything.
  useEffect(() => {
    if (!resume) return;
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
      window.sessionStorage.removeItem('faydaSignup');
    }
  }, [resume]);

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
      setSubmitError('');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setErrors({});
      setSubmitError('');
    }
  };

  const handleSubmit = async () => {
    setSubmitError('');
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

          const message = `An account with this ${field} already exists. Please sign in instead, or use a different ${field}.`;
          setSubmitError(message);
          onError?.(
            'Account Already Exists',
            message,
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
      setSubmitError(message);
      onError?.('Error', message);
    }
  };

  if (successMessage) {
    return <FormSuccess title="✓ Success" message={successMessage} />;
  }

  return (
    <div>
      {/* Progress Steps ─ professional horizontal stepper */}
      <div className="mb-8">
        <ol className="flex items-start">
          {[
            { en: 'Personal', am: 'ግል' },
            { en: 'Contact', am: 'ግንኙነት' },
            { en: 'Fayda', am: 'Fayda' },
            { en: 'OTP', am: 'ኦቲፒ' },
            { en: 'PIN', am: 'PIN' },
          ].map((label, i) => {
            const stepNo = i + 1;
            const isDone = stepNo < step;
            const isActive = stepNo === step;
            return (
              <li
                key={label.en}
                aria-current={isActive ? 'step' : undefined}
                className="relative flex-1 flex flex-col items-center min-w-0"
              >
                {i < 4 && (
                  <div
                    className={`absolute top-5 left-1/2 w-full h-0.5 -translate-x-1/2 z-0 transition-colors duration-300 ${
                      stepNo < step ? 'bg-[#0066ff]' : 'bg-gray-200'
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isDone
                      ? 'bg-[#0066ff] text-white'
                      : isActive
                        ? 'bg-[#0066ff] text-white shadow-lg ring-4 ring-blue-100'
                        : 'bg-white text-gray-400 border-2 border-gray-200'
                  }`}
                >
                  {isDone ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    stepNo
                  )}
                </div>
                <span
                  className={`mt-2 text-[11px] font-semibold uppercase tracking-wide text-center leading-tight ${
                    isActive ? 'text-[#0066ff]' : isDone ? 'text-gray-700' : 'text-gray-400'
                  }`}
                >
                  {lang === 'en' ? label.en : label.am}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#0066ff] h-full rounded-full transition-all duration-500"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Header */}
      <div className="mb-6 pb-4 border-b border-gray-200 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#0066ff]">
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
        <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#0066ff] border border-blue-100">
          {lang === 'en' ? `Step ${step} of 5` : `ደረጃ ${step} ከ 5`}
        </span>
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
            className="w-full py-3 bg-[#0066ff] text-white font-bold rounded-lg hover:bg-[#0066ff] transition-all duration-200 mt-8"
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
              className="flex-1 py-3 border-2 border-[#0066ff] text-[#0066ff] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-3 bg-[#0066ff] text-white font-bold rounded-lg hover:bg-[#0066ff] transition-all"
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
            <p className="text-xs text-brand-600 bg-brand-50 border border-brand-200 rounded-md px-3 py-2">
              ✓ Fayda ID verified
            </p>
          )}

          <div className="flex items-center gap-3 my-4">
            <span className="flex-1 h-px bg-gray-300" />
            <span className="text-xs text-gray-500 font-medium">
              {lang === 'en' ? 'OR' : 'ወይም'}
            </span>
            <span className="flex-1 h-px bg-gray-300" />
          </div>

          <button
            type="button"
            onClick={handleSignInWithFayda}
            disabled={faydaOidc.starting}
            className="w-full py-3 bg-white border-2 border-[#0066ff] text-[#0066ff] font-bold rounded-lg hover:bg-brand-50 transition-all disabled:opacity-50"
          >
            {faydaOidc.starting
              ? lang === 'en'
                ? '⏳ Opening Fayda...'
                : '⏳ በመክፈት ላይ...'
              : lang === 'en'
                ? '🪪 Sign in with Real Fayda (eSignet OTP)'
                : '🪪 በእውነተኛ Fayda ይግቡ (eSignet OTP)'}
          </button>

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 py-3 border-2 border-[#0066ff] text-[#0066ff] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleVerifyFayda}
              disabled={fayda.loading || otp.sending}
              className="flex-1 py-3 bg-[#0066ff] text-white font-bold rounded-lg hover:bg-[#0066ff] transition-all disabled:opacity-50"
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
            <p className="text-xs text-brand-600 bg-brand-50 border border-brand-200 rounded-md px-3 py-2">
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
          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
            <p className="text-sm text-[#0066ff]">
              {lang === 'en'
                ? `Enter the 6-digit code sent to ${formData.phoneNumber}.`
                : `ወደ ${formData.phoneNumber} የተላከውን 6-አሃዝ ኮድ ያስገቡ።`}
            </p>
          </div>

          {/* Temporary universal dev OTP — shown until government SMS approval */}
          <div className="bg-brand-50/70 border border-brand-300 rounded-lg p-3">
            <p className="text-xs text-[#0042ad] font-semibold">
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
            className="w-full text-sm text-[#0066ff] font-semibold underline hover:text-[#0066ff] transition-all disabled:opacity-50"
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
              className="flex-1 py-3 border-2 border-[#0066ff] text-[#0066ff] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleVerifyOtp}
              disabled={otp.verifying}
              className="flex-1 py-3 bg-[#0066ff] text-white font-bold rounded-lg hover:bg-[#0066ff] transition-all disabled:opacity-50"
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
          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
            <p className="text-sm text-[#0066ff]">
              {lang === 'en'
                ? 'Create a 6-digit PIN for your account security'
                : 'ሂሳብ ደህንነት ለ 6-ዲጂት PIN ይሰሩ'}
            </p>
          </div>

          <FormInput
            label={lang === 'en' ? '🔐 Your PIN' : '🔐 PIN'}
            type="password"
            value={formData.pin}
            onChange={(value) => handleFieldChange('pin', value)}
            placeholder="••••"
            maxLength={6}
            error={errors.pin}
            hint={lang === 'en' ? '6 digits' : '6 ዲጂት'}
          />

          {submitError && (
            <p className="text-xs text-brand-600 bg-brand-50 border border-brand-300 rounded-md px-3 py-2">
              {submitError}
            </p>
          )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={handleBack}
              className="flex-1 py-3 border-2 border-[#0066ff] text-[#0066ff] font-bold rounded-lg hover:bg-gray-50 transition-all"
            >
              {lang === 'en' ? '← Back' : '← ተመለስ'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 py-3 bg-[#0066ff] text-white font-bold rounded-lg hover:bg-[#0066ff] transition-all disabled:opacity-50"
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

