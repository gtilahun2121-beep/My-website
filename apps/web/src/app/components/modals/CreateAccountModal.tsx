'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';
import FormSuccess from '@/app/components/forms/FormSuccess';
import { ValidationSchema } from '@/app/utils/validation';

interface CreateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
  onSuccess?: (title: string, message: string) => void;
  onError?: (title: string, message: string) => void;
}

export default function CreateAccountModal({
  isOpen,
  onClose,
  lang = defaultLanguage,
  onSuccess,
  onError,
}: CreateAccountModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<'account' | 'otp'>('account');
  const [formData, setFormData] = useState({
    email: '',
    phoneNumber: '',
    fayda: '',
  });
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const t = translations[lang];

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateAccountForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email required';
    } else if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone required';
    } else {
      const validation = ValidationSchema.validatePhone(formData.phoneNumber);
      if (!validation.valid) newErrors.phoneNumber = validation.error || 'Invalid phone';
    }

    if (!formData.fayda.trim()) newErrors.fayda = 'Fayda ID required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOtpForm = () => {
    const newErrors: Record<string, string> = {};

    if (!otp.trim()) {
      newErrors.otp = 'OTP required';
    } else if (otp.length !== 5) {
      newErrors.otp = 'OTP must be 5 digits';
    } else if (!/^\d+$/.test(otp)) {
      newErrors.otp = 'OTP must contain only numbers';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAccountSubmit = async () => {
    if (!validateAccountForm()) {
      onError?.('Validation Error', 'Please fill all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate sending OTP
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStep('otp');
    } catch (error) {
      onError?.('Error', 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!validateOtpForm()) {
      onError?.('Validation Error', 'Please enter a valid 5-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      // Simulate OTP verification
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // After OTP verification:
      // 1. Check if user is existing or new (in real system, from backend)
      // 2. If existing: redirect to dashboard
      // 3. If new: redirect to complete-profile page
      // 4. Create secure session/token (handled by auth provider)
      
      const isExistingUser = Math.random() > 0.5; // Mock check - in real system check from backend
      
      if (isExistingUser) {
        setSuccessMessage('✓ OTP verified! Redirecting to dashboard...');
        onSuccess?.('Success', 'Welcome back! Redirecting to your dashboard...');
        setTimeout(() => {
          handleClose();
          router.push('/dashboard');
        }, 2000);
      } else {
        setSuccessMessage('✓ OTP verified! Complete your profile...');
        onSuccess?.('Success', 'Please complete your profile information...');
        setTimeout(() => {
          handleClose();
          router.push('/complete-profile');
        }, 2000);
      }
    } catch (error) {
      onError?.('Error', 'OTP verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('account');
    setFormData({ email: '', phoneNumber: '', fayda: '' });
    setOtp('');
    setErrors({});
    setSuccessMessage('');
    onClose();
  };

  if (successMessage) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <FormSuccess title="✓ Success" message={successMessage} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] px-8 py-6 flex justify-between items-center rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-black text-white">
                  {step === 'account' ? '🏦 Create Account' : '✅ Verify OTP'}
                </h2>
                <p className="text-sm text-white/80 font-semibold mt-1">
                  {lang === 'en' ? 'Complete your Equb profile' : 'በእርስዎ Equb ተጠናቀቁ'}
                </p>
              </div>
              <button
                onClick={handleClose}
                className="text-2xl text-white hover:opacity-70 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-4">
              {step === 'account' ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {lang === 'en'
                      ? 'Fill in your details to create your account'
                      : 'መግለጫዎን ይሙሉ'}
                  </p>

                  {/* Email */}
                  <FormInput
                    label={lang === 'en' ? 'Email' : lang === 'am' ? 'ኢሜል' : 'Email'}
                    type="email"
                    value={formData.email}
                    onChange={(value) => handleFieldChange('email', value)}
                    placeholder="your.email@example.com"
                    error={errors.email}
                  />

                  {/* Phone Number */}
                  <FormInput
                    label={lang === 'en' ? 'Phone Number' : lang === 'am' ? 'ስልክ ቁጥር' : 'Bilbila'}
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(value) => handleFieldChange('phoneNumber', value)}
                    placeholder="+251 9XX XXX XXXX"
                    error={errors.phoneNumber}
                  />

                  {/* Fayda ID */}
                  <FormInput
                    label={lang === 'en' ? 'Fayda ID' : 'Fayda ID'}
                    type="text"
                    value={formData.fayda}
                    onChange={(value) => handleFieldChange('fayda', value)}
                    placeholder={lang === 'en' ? 'Enter your Fayda ID' : 'ID galchaa'}
                    error={errors.fayda}
                  />

                  {/* Submit Button */}
                  <FormButton
                    onClick={handleAccountSubmit}
                    loading={isLoading}
                    disabled={isLoading}
                    variant="primary"
                  >
                    {isLoading
                      ? '⏳ Sending OTP...'
                      : lang === 'en'
                      ? 'Send OTP'
                      : 'OTP Ergaa'}
                  </FormButton>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {lang === 'en'
                      ? 'Enter the 5-digit OTP sent to your phone'
                      : 'OTP ገብአ'}
                  </p>

                  {/* OTP Input */}
                  <FormInput
                    label={lang === 'en' ? 'OTP Code' : lang === 'am' ? 'OTP ኮድ' : 'OTP'}
                    type="text"
                    value={otp}
                    onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="00000"
                    maxLength={5}
                    error={errors.otp}
                  />

                  {/* Verify Button */}
                  <FormButton
                    onClick={handleOtpSubmit}
                    loading={isLoading}
                    disabled={isLoading}
                    variant="primary"
                  >
                    {isLoading
                      ? '⏳ Verifying...'
                      : lang === 'en'
                      ? 'Verify OTP'
                      : 'OTP ሂድ'}
                  </FormButton>

                  {/* Back Button */}
                  <button
                    onClick={() => setStep('account')}
                    className="w-full text-center text-sm text-gray-600 hover:text-[#0d7e4d] font-semibold"
                  >
                    ← {lang === 'en' ? 'Back' : 'ተመለስ'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
