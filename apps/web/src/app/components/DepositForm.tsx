'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

interface DepositFormData {
  phone: string;
  pin: string;
  amount: string;
  paymentMethod: string;
}

interface DepositFormProps {
  onSubmit?: (data: DepositFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export default function DepositForm({
  onSubmit,
  onCancel,
  isLoading = false,
}: DepositFormProps) {
  const [formData, setFormData] = useState<DepositFormData>({
    phone: '+251',
    pin: '',
    amount: '',
    paymentMethod: 'telebirr',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Validate phone number format
  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^\+251\d{9}$/;
    return phoneRegex.test(phone);
  };

  // Validate PIN format (4 digits)
  const validatePin = (pin: string): boolean => {
    return /^\d{4}$/.test(pin);
  };

  // Validate amount (positive number)
  const validateAmount = (amount: string): boolean => {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && num <= 999999;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    // Ensure it starts with +251
    if (!value.startsWith('+251')) {
      value = '+251';
    }
    // Remove non-digits except the +
    value = '+' + value.slice(1).replace(/\D/g, '');
    // Limit to +251 + 9 digits
    if (value.length > 13) {
      value = value.slice(0, 13);
    }
    setFormData({ ...formData, phone: value });
    if (errors.phone) {
      setErrors({ ...errors, phone: '' });
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) {
      value = value.slice(0, 4);
    }
    setFormData({ ...formData, pin: value });
    if (errors.pin) {
      setErrors({ ...errors, pin: '' });
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    setFormData({ ...formData, amount: value });
    if (errors.amount) {
      setErrors({ ...errors, amount: '' });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Phone must be in format +251XXXXXXXXX (9 digits after +251)';
    }

    if (!validatePin(formData.pin)) {
      newErrors.pin = 'PIN must be exactly 4 digits';
    }

    if (!validateAmount(formData.amount)) {
      newErrors.amount = 'Amount must be between 1 and 999,999 ETB';
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Please select a payment method';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setMessage('');

    if (!validateForm()) {
      return;
    }

    setSubmitLoading(true);

    try {
      if (onSubmit) {
        await onSubmit(formData);
        setSuccess(true);
        setMessage('Deposit successful! Your account will be credited shortly.');
        // Reset form
        setFormData({
          phone: '+251',
          pin: '',
          amount: '',
          paymentMethod: 'telebirr',
        });
      }
    } catch (error: any) {
      setSuccess(false);
      setMessage(error.message || 'Deposit failed. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const paymentMethods = [
    { value: 'telebirr', label: 'Telebirr' },
    { value: 'cbe', label: 'CBE Bank' },
    { value: 'abyssinia', label: 'Abyssinia Bank' },
    { value: 'dashen', label: 'Dashen Bank' },
    { value: 'awash', label: 'Awash Bank' },
    { value: 'nib', label: 'NIB' },
  ];

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-[#00d9ff]">Make a Deposit</h2>
          <p className="text-gray-600 mt-1">Add funds to your wallet</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 p-4 bg-brand-50 border border-brand-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-brand-800 font-medium">Success</p>
              <p className="text-brand-700 text-sm">{message}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {message && !success && (
          <div className="mb-4 p-4 bg-brand-50 border border-brand-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-brand-800 font-medium">Notice</p>
              <p className="text-brand-700 text-sm">{message}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Phone Number */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-[#00d9ff] mb-1">
              Phone Number <span className="text-brand-500">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder="+251904556677"
              className={`w-full px-4 py-2 border rounded-lg font-mono text-sm md:text-base transition-colors ${
                errors.phone
                  ? 'border-brand-500 bg-brand-50 focus:outline-none focus:ring-2 focus:ring-amber-500'
                  : 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
              }`}
              disabled={submitLoading || isLoading}
            />
            {errors.phone && (
              <p className="text-brand-600 text-xs md:text-sm mt-1">{errors.phone}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">Format: +251XXXXXXXXX</p>
          </div>

          {/* PIN */}
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-[#00d9ff] mb-1">
              PIN <span className="text-brand-500">*</span>
            </label>
            <input
              type="password"
              id="pin"
              value={formData.pin}
              onChange={handlePinChange}
              placeholder="••••"
              maxLength={4}
              className={`w-full px-4 py-2 border rounded-lg text-center text-lg tracking-widest font-mono transition-colors ${
                errors.pin
                  ? 'border-brand-500 bg-brand-50 focus:outline-none focus:ring-2 focus:ring-amber-500'
                  : 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
              }`}
              disabled={submitLoading || isLoading}
            />
            {errors.pin && (
              <p className="text-brand-600 text-xs md:text-sm mt-1">{errors.pin}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">4-digit PIN</p>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-[#00d9ff] mb-1">
              Amount (ETB) <span className="text-brand-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-600 font-medium">
                ETB
              </span>
              <input
                type="text"
                id="amount"
                value={formData.amount}
                onChange={handleAmountChange}
                placeholder="0"
                className={`w-full pl-12 pr-4 py-2 border rounded-lg text-right text-sm md:text-base transition-colors ${
                  errors.amount
                    ? 'border-brand-500 bg-brand-50 focus:outline-none focus:ring-2 focus:ring-amber-500'
                    : 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }`}
                disabled={submitLoading || isLoading}
              />
            </div>
            {errors.amount && (
              <p className="text-brand-600 text-xs md:text-sm mt-1">{errors.amount}</p>
            )}
            {formData.amount && !errors.amount && (
              <p className="text-gray-500 text-xs mt-1">
                You will deposit: <span className="font-semibold text-[#00d9ff]">{parseInt(formData.amount).toLocaleString()} ETB</span>
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-[#00d9ff] mb-1">
              Payment Method <span className="text-brand-500">*</span>
            </label>
            <select
              id="paymentMethod"
              value={formData.paymentMethod}
              onChange={(e) => {
                setFormData({ ...formData, paymentMethod: e.target.value });
                if (errors.paymentMethod) {
                  setErrors({ ...errors, paymentMethod: '' });
                }
              }}
              className={`w-full px-4 py-2 border rounded-lg text-sm md:text-base transition-colors ${
                errors.paymentMethod
                  ? 'border-brand-500 bg-brand-50 focus:outline-none focus:ring-2 focus:ring-amber-500'
                  : 'border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500'
              }`}
              disabled={submitLoading || isLoading}
            >
              <option value="">Select a payment method</option>
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            {errors.paymentMethod && (
              <p className="text-brand-600 text-xs md:text-sm mt-1">{errors.paymentMethod}</p>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitLoading || isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-[#00d9ff] hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitLoading || isLoading}
              className="flex-1 px-4 py-2 bg-brand-900 hover:bg-brand-950 text-[#00d9ff] font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
            >
              {submitLoading || isLoading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Deposit {formData.amount ? `${formData.amount} ETB` : ''}</span>
              )}
            </button>
          </div>

          {/* Terms */}
          <p className="text-gray-600 text-xs md:text-sm text-center">
            By depositing, you agree to our{' '}
            <a href="/terms" className="text-brand-600 hover:underline">
              Terms of Service
            </a>
          </p>
        </form>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-brand-50 border border-brand-200 rounded-lg p-4 md:p-6">
        <h3 className="text-sm md:text-base font-semibold text-brand-900 mb-2">Transaction Information</h3>
        <ul className="text-xs md:text-sm text-brand-800 space-y-2">
          <li className="flex gap-2">
            <span className="flex-shrink-0">•</span>
            <span>Deposits are processed within 30 seconds</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">•</span>
            <span>Minimum deposit: 50 ETB</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">•</span>
            <span>Maximum deposit: 999,999 ETB</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0">•</span>
            <span>No transaction fees on deposits</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
