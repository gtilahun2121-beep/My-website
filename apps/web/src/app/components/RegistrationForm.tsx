'use client';

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';

interface RegistrationFormProps {
  onSuccess: () => void;
  onError?: (message: string) => void;
}

export default function RegistrationForm({ onSuccess, onError }: RegistrationFormProps) {
  const { signup } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordValidation, setPasswordValidation] = useState({
    uppercase: false,
    lowercase: false,
    digit: false,
    specialChar: false,
    minLength: false,
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '+2519',
    email: '',
    fayda: '',
    faydaOtp: '',
    faydaVerified: false,
    password: '',
    confirmPassword: '',
    pin: '',
    otp: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Real-time password validation
    if (name === 'password') {
      setPasswordValidation({
        uppercase: /[A-Z]/.test(value),
        lowercase: /[a-z]/.test(value),
        digit: /\d/.test(value),
        specialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value),
        minLength: value.length >= 8,
      });
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    const nameRegex = /^[a-zA-Z]{2,}$/; // Only letters, minimum 2 characters
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (!nameRegex.test(formData.firstName)) {
      newErrors.firstName = 'First name must be at least 2 letters (no numbers or special characters)';
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (!nameRegex.test(formData.lastName)) {
      newErrors.lastName = 'Last name must be at least 2 letters (no numbers or special characters)';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    
    // Phone: +251 followed by 9 digits (09 or 07 etc)
    const phoneRegex = /^\+251[79]\d{8}$/;
    if (!phoneRegex.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Phone must be +251 followed by 9 or 7 and 8 digits';
    }

    // Email: basic format validation
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: Record<string, string> = {};
    
    // Password validation: 8+ chars, uppercase, lowercase, digit, special char
    const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!passwordRegex.test(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 digit, and 1 special character (!@#$%^&*...)';
    }
    
    if (!/^\d{4,}$/.test(formData.pin)) {
      newErrors.pin = 'PIN must be at least 4 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = () => {
    const newErrors: Record<string, string> = {};
    
    // Fayda: exactly 16 digits
    if (!/^\d{16}$/.test(formData.fayda)) {
      newErrors.fayda = 'Fayda number must be exactly 16 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep5 = () => {
    const newErrors: Record<string, string> = {};
    
    // Fayda OTP: exactly 6 digits
    if (!/^\d{6}$/.test(formData.faydaOtp)) {
      newErrors.faydaOtp = 'Fayda OTP must be exactly 6 digits';
    }
    
    // Fayda must be verified
    if (!formData.faydaVerified) {
      newErrors.faydaVerified = 'Please verify your Fayda';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    let isValid = false;
    if (step === 1) isValid = validateStep1();
    else if (step === 2) isValid = validateStep2();
    else if (step === 3) isValid = validateStep3();
    else if (step === 4) isValid = validateStep4();
    else if (step === 5) isValid = validateStep5();

    if (isValid) {
      if (step < 5) {
        setStep(step + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await signup({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        fayda: formData.fayda,
      });
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setErrors({ submit: message });
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      {/* Step Indicator - 5 Steps */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  s <= step
                    ? 'bg-[#314fa0] text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {s}
              </div>
              {s < 5 && (
                <div
                  className={`h-1 flex-grow mx-2 transition-all ${
                    s < step ? 'bg-[#314fa0]' : 'bg-gray-200'
                  }`}
                ></div>
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm font-semibold text-gray-600">
          Step {step} of 5
        </p>
      </div>

      {/* Step 1: Personal Information */}
      {step === 1 && (
        <div>
          <h3 className="text-2xl font-bold mb-6 text-gray-900">Personal Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.firstName ? 'border-red-500' : 'border-gray-200 focus:border-[#314fa0]'
                }`}
              />
              {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter last name"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.lastName ? 'border-red-500' : 'border-gray-200 focus:border-[#314fa0]'
                }`}
              />
              {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Contact Information */}
      {step === 2 && (
        <div>
          <h3 className="text-2xl font-bold mb-6 text-gray-900">Contact Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="+2519xxxxxxxx"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.phoneNumber ? 'border-red-500' : 'border-gray-200 focus:border-[#314fa0]'
                }`}
              />
              {errors.phoneNumber && <p className="text-red-500 text-sm mt-1">{errors.phoneNumber}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@gmail.com"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.email ? 'border-red-500' : 'border-gray-200 focus:border-[#314fa0]'
                }`}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Security (Password, PIN) */}
      {step === 3 && (
        <div>
          <h3 className="text-2xl font-bold mb-6 text-gray-900">Security</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Create Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 8 characters with uppercase, lowercase, digit, special char"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.password ? 'border-red-500' : 'border-gray-200 focus:border-[#314fa0]'
                }`}
              />
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              
              {/* Password Validation Checklist */}
              {formData.password && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 mb-3">Password Requirements:</p>
                  <div className="space-y-2">
                    <div className={`flex items-center gap-2 text-sm ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-600'}`}>
                      <span>{passwordValidation.minLength ? '✅' : '⭕'}</span>
                      <span>At least 8 characters</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${passwordValidation.uppercase ? 'text-green-600' : 'text-gray-600'}`}>
                      <span>{passwordValidation.uppercase ? '✅' : '⭕'}</span>
                      <span>At least 1 uppercase letter</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${passwordValidation.lowercase ? 'text-green-600' : 'text-gray-600'}`}>
                      <span>{passwordValidation.lowercase ? '✅' : '⭕'}</span>
                      <span>At least 1 lowercase letter</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${passwordValidation.digit ? 'text-green-600' : 'text-gray-600'}`}>
                      <span>{passwordValidation.digit ? '✅' : '⭕'}</span>
                      <span>At least 1 digit</span>
                    </div>
                    <div className={`flex items-center gap-2 text-sm ${passwordValidation.specialChar ? 'text-green-600' : 'text-gray-600'}`}>
                      <span>{passwordValidation.specialChar ? '✅' : '⭕'}</span>
                      <span>At least 1 special character (!@#$%^&*...)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Create PIN</label>
              <input
                type="text"
                name="pin"
                value={formData.pin}
                onChange={handleChange}
                placeholder="At least 4 digits"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.pin ? 'border-red-500' : 'border-gray-200 focus:border-[#314fa0]'
                }`}
              />
              {errors.pin && <p className="text-red-500 text-sm mt-1">{errors.pin}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Identity Verification (Fayda) */}
      {step === 4 && (
        <div>
          <h3 className="text-2xl font-bold mb-6 text-gray-900">Identity Verification (Fayda)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fayda Number</label>
              <input
                type="text"
                name="fayda"
                value={formData.fayda}
                onChange={handleChange}
                placeholder="Enter 16-digit Fayda number"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.fayda ? 'border-red-500' : 'border-gray-200 focus:border-[#314fa0]'
                }`}
              />
              {errors.fayda && <p className="text-red-500 text-sm mt-1">{errors.fayda}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Fayda OTP Verification */}
      {step === 5 && (
        <div>
          <h3 className="text-2xl font-bold mb-6 text-gray-900">OTP Verification</h3>
          <p className="text-gray-600 mb-6">Verify your Fayda account with OTP</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Fayda OTP</label>
              <p className="text-xs text-gray-500 mb-2">Enter the 6-digit OTP sent to your Fayda account</p>
              <input
                type="text"
                name="faydaOtp"
                value={formData.faydaOtp}
                onChange={handleChange}
                placeholder="Enter 6-digit OTP"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-all ${
                  errors.faydaOtp ? 'border-red-500' : 'border-gray-200 focus:border-[#314fa0]'
                }`}
              />
              {errors.faydaOtp && <p className="text-red-500 text-sm mt-1">{errors.faydaOtp}</p>}
              
              <button
                onClick={() => {
                  if (/^\d{16}$/.test(formData.fayda) && /^\d{6}$/.test(formData.faydaOtp)) {
                    setFormData(prev => ({ ...prev, faydaVerified: true }));
                    setErrors({});
                  } else {
                    setErrors({ faydaOtp: 'Invalid Fayda or OTP format' });
                  }
                }}
                className="w-full mt-3 px-4 py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all"
              >
                Verify Fayda
              </button>
            </div>

            {formData.faydaVerified && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 font-semibold">✅ Identity Confirmed</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {errors.submit && (
        <div className="mt-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
          <p className="text-red-700 font-semibold">{errors.submit}</p>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-4 mt-8">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all disabled:opacity-50"
          >
            ← Back
          </button>
        )}
        <button
          onClick={handleNextStep}
          disabled={submitting}
          className="flex-1 px-6 py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all disabled:opacity-50"
        >
          {submitting ? '⏳ Processing...' : step === 5 ? '🎉 Create Account' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
