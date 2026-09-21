'use client';

import React, { useState } from 'react';
import { walletAPI } from '../../services/api';

const EyeIcon: React.FC<{ open: boolean; className?: string }> = ({ open, className }) =>
  open ? (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

interface WithdrawalProps {
  balance: number;
  onSuccess: (result: WithdrawalResult) => void;
  onCancel: () => void;
}

interface WithdrawalResult {
  success: boolean;
  message: string;
  transaction_id?: string;
}

type WithdrawalStep = 'pin-entry' | 'method-selection' | 'account-entry' | 'confirmation' | 'error';

type WithdrawalMethod = 'et_national_bank' | 'telebirr' | 'chapa' | 'other';

export const Withdrawal: React.FC<WithdrawalProps> = ({ balance, onSuccess, onCancel }) => {
  const [step, setStep] = useState<WithdrawalStep>('pin-entry');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod | null>(null);
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);

  const withdrawalMethods: { id: WithdrawalMethod; name: string; description: string; icon: string }[] = [
    {
      id: 'et_national_bank',
      name: 'Ethiopian National Bank',
      description: 'Transfer to Ethiopian National Bank account',
      icon: '🏦',
    },
    {
      id: 'telebirr',
      name: 'Telebirr',
      description: 'Withdraw via Telebirr mobile money',
      icon: '📱',
    },
    {
      id: 'chapa',
      name: 'Chapa',
      description: 'Withdraw via Chapa payment gateway',
      icon: '🏦',
    },
    {
      id: 'other',
      name: 'Other Account',
      description: 'Enter another account',
      icon: 'ℹ️',
    },
  ];

  const validateAccount = (method: WithdrawalMethod, value: string): string | null => {
    if (method === 'et_national_bank') {
      if (!/^\d{13}$/.test(value)) {
        return 'Ethiopian National Bank account must be exactly 13 digits';
      }
      if (!value.startsWith('1000')) {
        return 'The account number must start with 1000. This account does not exist.';
      }
      return null;
    }
    if (method === 'telebirr') {
      if (!/^\+2519\d{8}$/.test(value)) {
        return 'Valid Telebirr phone number required (format: +2519XXXXXXX)';
      }
      return null;
    }
    if (method === 'chapa') {
      if (value.trim().length < 6) {
        return 'Please enter a valid account number';
      }
      return null;
    }
    return null;
  };

  const handleMethodSelect = (method: WithdrawalMethod) => {
    setSelectedMethod(method);
    setAccountNumber('');
    setAccountName('');
    setShowComingSoon(false);
    setError(null);

    if (method === 'other') {
      setAccountName('Coming soon');
      setShowComingSoon(true);
      return;
    }

    setStep('account-entry');
  };

  const handlePinConfirm = async () => {
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount to withdraw');
      return;
    }
    if (parsedAmount > balance) {
      setError(`Insufficient balance. Available: ETB ${balance.toLocaleString()}`);
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await walletAPI.verifyPin(pin);
      setStep('method-selection');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Incorrect PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupAccountName = () => {
    if (selectedMethod === 'other') {
      setShowComingSoon(true);
      return;
    }
    const validationError = validateAccount(selectedMethod as WithdrawalMethod, accountNumber);
    if (validationError) {
      setError(validationError);
      setAccountName('');
      setShowComingSoon(false);
      return;
    }
    setError(null);
    setShowComingSoon(true);
    setAccountName('Coming soon — account name lookup');
  };

  const handleWithdraw = async () => {
    if (!accountNumber) {
      setError('Please enter the account number you want to transfer to');
      return;
    }

    if (selectedMethod === 'other') {
      setError('Other accounts are not available yet. Coming soon.');
      setShowComingSoon(true);
      return;
    }

    const validationError = validateAccount(selectedMethod as WithdrawalMethod, accountNumber);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await walletAPI.withdraw(
        parseFloat(amount),
        selectedMethod as WithdrawalMethod,
        accountNumber,
        pin,
      );
      setStep('confirmation');
      onSuccess({
        success: true,
        message: 'Withdrawal successful',
        transaction_id: result?.balance?.toString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg max-w-md w-full overflow-hidden">
      {/* Header */}
      <div className="bg-[#0066ff] text-white p-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Withdrawal</h2>
          <p className="text-sm opacity-90">Transfer money to your bank or mobile money</p>
        </div>
        <button onClick={onCancel} className="text-2xl hover:opacity-80" aria-label="Close">
          ✕
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        {['PIN', 'Method', 'Account', 'Done'].map((label, i) => {
          const idx = step === 'pin-entry' ? 0 : step === 'method-selection' ? 1 : step === 'account-entry' ? 2 : 3;
          const active = i === idx;
          const done = i < idx;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  done ? 'bg-brand-500 text-white' : active ? 'bg-[#0066ff] text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-[#0066ff]' : 'text-gray-500'}`}>{label}</span>
              {i < 3 && <span className="w-4 h-px bg-gray-300" />}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-brand-50 border border-brand-300 text-sm text-brand-700">
              {error}
            </div>
          )}

          {step === 'pin-entry' && (
            <>
              <div className="bg-gradient-to-r from-brand-50/70 to-brand-100/60 rounded-xl p-4 mb-6 text-center border border-brand-100">
                <p className="text-sm text-gray-600 mb-1">Available Balance</p>
                <p className="text-4xl font-bold text-brand-600">
                  ETB {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>

              <label className="block font-semibold text-[#0066ff] mb-2">Amount to Withdraw (ETB)</label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full p-4 rounded-lg border border-gray-300 focus:border-[#0066ff] focus:outline-none mb-4"
              />

              <label className="block font-semibold text-[#0066ff] mb-2">Enter your registered password / PIN</label>
              <div className="relative mb-4">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder=""
                  className="w-full text-center text-2xl tracking-[0.5em] p-4 pr-14 rounded-lg border border-gray-300 focus:border-[#0066ff] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-[#0066ff] hover:bg-gray-100 transition-colors"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  <EyeIcon open={showPin} />
                </button>
              </div>

              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-gray-500">
                  🔒 Verified against your registered password before processing.
                </p>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-xs font-medium text-gray-600">
                    {showPin ? 'Hide' : 'Show'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showPin}
                    aria-label="Toggle PIN visibility"
                    onClick={() => setShowPin((v) => !v)}
                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:ring-offset-2 ${
                      showPin ? 'bg-[#0066ff]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showPin ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              </div>

              <button
                onClick={handlePinConfirm}
                disabled={!amount || !/^\d{6}$/.test(pin) || loading}
                className="w-full bg-[#0066ff] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#0066ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify PIN & Continue
              </button>
            </>
          )}

          {step === 'method-selection' && (
            <>
              <p className="font-semibold text-[#0066ff] mb-4">Select Withdrawal Method</p>
              <div className="space-y-3 mb-6">
                {withdrawalMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => handleMethodSelect(method.id)}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedMethod === method.id
                        ? 'border-[#0066ff] bg-brand-50'
                        : 'border-gray-200 hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{method.icon}</span>
                      <div>
                        <p className="font-semibold text-[#0066ff]">{method.name}</p>
                        <p className="text-sm text-gray-600">{method.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('pin-entry')}
                  className="flex-1 border border-gray-300 text-[#0066ff] px-4 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {step === 'account-entry' && (
            <>
              <p className="font-semibold text-[#0066ff] mb-4">
                {selectedMethod === 'et_national_bank'
                  ? 'Enter the Ethiopian National Bank account number you want to transfer to'
                  : selectedMethod === 'telebirr'
                  ? 'Enter the Telebirr phone number you want to transfer to'
                  : 'Enter the account number you want to transfer to'}
              </p>

              {selectedMethod === 'et_national_bank' && (
                <p className="text-xs text-gray-500 mb-3">
                  Account number must be 13 digits and start with 1000.
                </p>
              )}

              <input
                type="text"
                inputMode={selectedMethod === 'telebirr' ? 'tel' : 'numeric'}
                value={accountNumber}
                onChange={(e) => {
                  let val = e.target.value;
                  if (selectedMethod === 'telebirr') {
                    val = val.replace(/[^\d+]/g, '');
                    val = val.replace(/(?!^)\+/g, '').slice(0, 13);
                  } else {
                    val = val.replace(/\D/g, '').slice(0, 13);
                  }
                  setAccountNumber(val);
                }}
                placeholder={selectedMethod === 'telebirr' ? '+251912345678' : 'Enter account number'}
                className="w-full p-3 rounded-lg border border-gray-300 focus:border-brand-500 focus:outline-none mb-4"
              />

              <button
                onClick={handleLookupAccountName}
                className="w-full bg-gray-100 text-[#0066ff] px-4 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors mb-4"
              >
                Look Up Account Name
              </button>

              {showComingSoon && (
                <div className="bg-yellow-50 rounded-lg p-3 mb-4 border border-yellow-200">
                  <p className="text-sm text-yellow-800 mb-1">Coming soon</p>
                  <p className="text-sm text-gray-600">
                    {accountName || 'Account name lookup is coming soon.'}
                  </p>
                </div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={!accountNumber || loading}
                className="w-full bg-[#0066ff] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#0047b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Proceed with Withdrawal'}
              </button>

              <button
                onClick={() => {
                  setStep('method-selection');
                  setAccountNumber('');
                  setAccountName('');
                  setShowComingSoon(false);
                  setError(null);
                }}
                className="w-full mt-3 border border-gray-300 text-[#0066ff] px-4 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Back to Methods
              </button>
            </>
          )}

          {step === 'confirmation' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg font-semibold text-[#0066ff] mb-2">Withdrawal Successful!</p>
              <p className="text-sm text-gray-600 mb-4">
                ETB {parseFloat(amount).toLocaleString()} has been withdrawn from your wallet.
              </p>
              <button
                onClick={onCancel}
                className="w-full bg-[#0066ff] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#0047b3] transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">❌</div>
              <p className="text-lg font-semibold text-brand-600 mb-2">Withdrawal Failed</p>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('account-entry')}
                  className="flex-1 border border-gray-300 text-[#0066ff] px-4 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 bg-[#0066ff] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#0047b3] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};

export default Withdrawal;
