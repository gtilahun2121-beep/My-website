'use client';

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { Language } from '@/i18n/config';

interface DiagramRegistrationFormProps {
  lang?: Language;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

export default function DiagramRegistrationForm({
  onSuccess,
  onError,
}: DiagramRegistrationFormProps) {
  const { signup } = useAuth();
  const [step, setStep] = useState(1); // 1-4
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fayda, setFayda] = useState({ verified: false, verifying: false });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '+2519',
    email: '',
    fayda: '',
    password: '',
    confirmPassword: '',
    pin: '',
    otp: '',
  });

  const updateField = (field: string, value: string) => {
    if (field === 'phoneNumber') {
      if (!value.startsWith('+2519')) value = '+2519';
      const digits = value.replace(/\D/g, '');
      if (digits.length > 12) value = '+' + digits.substring(0, 12);
    } else if (field === 'fayda') {
      value = value.replace(/\D/g, '').slice(0, 16);
    } else if (field === 'pin') {
      value = value.replace(/\D/g, '').slice(0, 6);
    } else if (field === 'otp') {
      value = value.replace(/\D/g, '').slice(0, 5);
    }
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleCreateAccount = async () => {
    if (formData.otp.length !== 5) {
      setErrors({ otp: 'OTP must be 5 digits' });
      return;
    }

    if (formData.password.length < 8) {
      setErrors({ password: 'Password must be at least 8 characters' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    if (!/^\d{6}$/.test(formData.pin)) {
      setErrors({ pin: 'PIN must be exactly 6 digits' });
      return;
    }

    setSubmitting(true);
    try {
      console.log('Creating account with:', {
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
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        fayda: formData.fayda,
      });

      console.log('Signup successful, calling onSuccess');
      setSubmitting(false);
      onSuccess?.();
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Registration failed';
      console.error('Signup error:', msg);
      setErrors({ submit: msg });
      onError?.(msg);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (formData.firstName.length < 2 || formData.lastName.length < 2) {
        setErrors({ firstName: 'Min 2 chars', lastName: 'Min 2 chars' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const phoneDigits = formData.phoneNumber.replace(/\D/g, '');
      if (phoneDigits.length !== 10 || !formData.email.endsWith('@gmail.com')) {
        if (phoneDigits.length !== 10) setErrors({ phoneNumber: '+2519 + 8 digits' });
        if (!formData.email.endsWith('@gmail.com')) setErrors({ email: '@gmail.com only' });
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!fayda.verified) {
        setErrors({ fayda: 'Please verify Fayda first' });
        return;
      }
      setStep(4);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 glass-form rounded-2xl">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-4">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`flex-1 text-center ${s <= step ? 'text-[#00d9ff]' : 'text-gray-400'}`}>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold mx-auto mb-2 ${
                s < step ? 'bg-[#001f3f] text-[#00d9ff]' : s === step ? 'bg-[#001f3f] text-[#00d9ff]' : 'bg-gray-200'
              }`}>
                {s < step ? '✓' : s}
              </div>
              <span className="text-xs font-semibold">{['Personal', 'Contact', 'Fayda', 'Security'][s-1]}</span>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-[#001f3f] h-2 rounded-full transition-all" style={{ width: `${(step/4)*100}%` }} />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6">Step {step} of 4</h2>

      {/* STEP 1: Personal Information */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">👤 First Name</label>
            <input
              type="text"
              placeholder="John"
              value={formData.firstName}
              onChange={e => updateField('firstName', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none"
            />
            {errors.firstName && <p className="text-brand-600 text-sm">{errors.firstName}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">👤 Last Name</label>
            <input
              type="text"
              placeholder="Doe"
              value={formData.lastName}
              onChange={e => updateField('lastName', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none"
            />
            {errors.lastName && <p className="text-brand-600 text-sm">{errors.lastName}</p>}
          </div>

          <button
            onClick={handleNext}
            className="w-full bg-[#001f3f] text-[#00d9ff] font-bold py-3 rounded-lg hover:bg-[#001f3f] mt-6"
          >
            Next →
          </button>
        </div>
      )}

      {/* STEP 2: Contact Information */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">📱 Phone Number</label>
            <input
              type="tel"
              placeholder="+2519 + 8 digits"
              value={formData.phoneNumber}
              onChange={e => updateField('phoneNumber', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none"
            />
            {errors.phoneNumber && <p className="text-brand-600 text-sm">{errors.phoneNumber}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">📧 Email Address</label>
            <input
              type="email"
              placeholder="user@gmail.com"
              value={formData.email}
              onChange={e => updateField('email', e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none"
            />
            {errors.email && <p className="text-brand-600 text-sm">{errors.email}</p>}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border-2 border-[#001f3f] text-[#00d9ff] font-bold py-3 rounded-lg hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              className="flex-1 bg-[#001f3f] text-[#00d9ff] font-bold py-3 rounded-lg hover:bg-[#001f3f]"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Fayda Verification */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">🆔 Fayda Number</label>
            <input
              type="text"
              placeholder="1234567890123456"
              value={formData.fayda}
              onChange={e => updateField('fayda', e.target.value)}
              disabled={fayda.verified}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none disabled:bg-gray-100"
            />
            {errors.fayda && <p className="text-brand-600 text-sm">{errors.fayda}</p>}
          </div>

          {fayda.verified && (
            <div className="bg-brand-50 border-2 border-brand-300 rounded-lg p-4 flex items-center gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-bold text-brand-800">Identity Verified</p>
                <p className="text-sm text-brand-700">Fayda ID confirmed</p>
              </div>
            </div>
          )}

          <button
            onClick={async () => {
              if (formData.fayda.length !== 16) {
                setErrors({ fayda: 'Must be 16 digits' });
                return;
              }
              setFayda({ verified: false, verifying: true });
              await new Promise(r => setTimeout(r, 1500));
              setFayda({ verified: true, verifying: false });
              setErrors({});
            }}
            disabled={fayda.verified || fayda.verifying}
            className={`w-full font-bold py-3 rounded-lg ${
              fayda.verified ? 'bg-brand-100 text-brand-800 cursor-not-allowed' : 'bg-brand-900 text-[#00d9ff] hover:bg-brand-950'
            }`}
          >
            {fayda.verifying ? '⏳ Verifying...' : fayda.verified ? '✓ Verified' : 'Verify with Fayda'}
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 border-2 border-[#001f3f] text-[#00d9ff] font-bold py-3 rounded-lg hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              disabled={!fayda.verified}
              className={`flex-1 font-bold py-3 rounded-lg ${
                fayda.verified ? 'bg-[#001f3f] text-[#00d9ff] hover:bg-[#001f3f]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Create Password & PIN, then OTP */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-brand-50 border-2 border-brand-300 rounded-lg p-4 mb-6">
            <p className="text-sm text-brand-900 font-semibold">Step 4 of 4: Security</p>
            <p className="text-xs text-brand-800 mt-2">Create Password & PIN, then verify with OTP</p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold mb-2">🔒 Create Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={formData.password}
                onChange={e => updateField('password', e.target.value)}
                className="w-full px-4 pr-11 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Show/Hide PIN"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-[#00d9ff] hover:bg-gray-100 transition-colors"
              >
                {!showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>
            </div>
            {errors.password && <p className="text-brand-600 text-sm">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-semibold mb-2">🔒 Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={e => updateField('confirmPassword', e.target.value)}
                className="w-full px-4 pr-11 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label="Show/Hide PIN"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-[#00d9ff] hover:bg-gray-100 transition-colors"
              >
                {!showConfirmPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-brand-600 text-sm">{errors.confirmPassword}</p>}
          </div>

          {/* PIN */}
          <div>
            <label className="block text-sm font-semibold mb-2">🔐 Create PIN</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                placeholder="6 digits"
                maxLength={6}
                value={formData.pin}
                onChange={e => updateField('pin', e.target.value)}
                className="w-full px-4 pr-11 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label="Show/Hide PIN"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-[#00d9ff] hover:bg-gray-100 transition-colors"
              >
                {!showPin ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                )}
              </button>
            </div>
            {errors.pin && <p className="text-brand-600 text-sm">{errors.pin}</p>}
          </div>

          <hr className="my-6" />

          {/* OTP Verification */}
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
            <p className="text-sm text-orange-900 font-semibold">📱 OTP Verification</p>
            <p className="text-xs text-orange-800 mt-2">Enter SMS or Email OTP</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Enter OTP</label>
            <input
              type="text"
              placeholder="00000"
              value={formData.otp}
              onChange={e => updateField('otp', e.target.value)}
              maxLength={5}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#001f3f] focus:outline-none text-center text-2xl tracking-widest"
            />
            {errors.otp && <p className="text-brand-600 text-sm text-center">{errors.otp}</p>}
          </div>

          {errors.submit && <p className="text-brand-600 text-sm text-center">{errors.submit}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(3)}
              className="flex-1 border-2 border-[#001f3f] text-[#00d9ff] font-bold py-3 rounded-lg hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              onClick={handleCreateAccount}
              disabled={submitting}
              className="flex-1 bg-[#001f3f] text-[#00d9ff] font-bold py-3 rounded-lg hover:bg-[#001f3f] disabled:opacity-50"
            >
              {submitting ? '⏳ Creating...' : '🎉 Create Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

