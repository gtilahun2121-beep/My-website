// ========================================================================
// PAYMENT FLOW COMPONENT
// Handles Payment Initiation, Gateway Checkout, and Confirmation
// ========================================================================

'use client';

import React, { useState } from 'react';
import { paymentsAPI } from '../../services/api';

interface PaymentFlowProps {
  equbId: string;
  roundNumber: number;
  amount: number;
  onSuccess: (result: CheckoutResult) => void;
  onCancel: () => void;
  language: 'en' | 'am' | 'om' | 'ti';
}

/** Real shape returned by POST /api/v1/payments/checkout. */
export interface CheckoutResult {
  payment_id?: string;
  checkout_url?: string;
  status: string;
  message: string;
}

type PaymentStep = 'method-selection' | 'gateway-redirect' | 'confirmation' | 'error';

export const PaymentFlow: React.FC<PaymentFlowProps> = ({
  equbId,
  roundNumber,
  amount,
  onSuccess,
  onCancel,
  language,
}) => {
  const [step, setStep] = useState<PaymentStep>('method-selection');
  const [selectedMethod, setSelectedMethod] = useState<'telebirr' | 'chapa' | 'wallet' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);

  const paymentMethods: { id: 'telebirr' | 'chapa' | 'wallet'; name: string; description: string; icon: string; available: boolean }[] = [
    {
      id: 'wallet',
      name: 'In-App Wallet',
      description: 'Use your QalNet wallet balance',
      icon: '💰',
      available: true,
    },
    {
      id: 'telebirr',
      name: 'Telebirr',
      description: 'Pay via Telebirr mobile money',
      icon: '📱',
      available: true,
    },
    {
      id: 'chapa',
      name: 'Chapa',
      description: 'Pay via Chapa payment gateway',
      icon: '🏦',
      available: true,
    },
  ];

  const handleInitiatePayment = async () => {
    if (!selectedMethod) return;

    setLoading(true);
    setError(null);

    try {
      const result = await paymentsAPI.checkout({
        equb_id: equbId,
        round_number: roundNumber,
        payment_method: selectedMethod,
      }) as CheckoutResult;

      setCheckoutResult(result);

      if (selectedMethod === 'wallet') {
        // Wallet payments are confirmed synchronously by the backend checkout endpoint.
        // No fabrication: use the real payment_id and status returned by the API.
        setStep('confirmation');
      } else {
        // External gateway — redirect using the real checkout_url from the backend.
        if (result.checkout_url) {
          setStep('gateway-redirect');
          window.location.assign(result.checkout_url);
        } else {
          setStep('confirmation');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initiation failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (checkoutResult) {
      onSuccess(checkoutResult);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0066ff] text-white p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Payment</h2>
          <button
            onClick={onCancel}
            className="text-2xl hover:opacity-80"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'method-selection' && (
            <>
              {/* Amount Display */}
              <div className="bg-brand-50 rounded-lg p-4 mb-6 text-center">
                <p className="text-sm text-gray-600 mb-1">Amount to Pay</p>
                <p className="text-4xl font-bold text-brand-600">
                  {amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-600 mt-1">ETB</p>
              </div>

              {/* Payment Methods */}
              <p className="font-semibold text-[#0066ff] mb-4">Select Payment Method</p>
              <div className="space-y-3 mb-6">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id)}
                    disabled={!method.available}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedMethod === method.id
                        ? 'border-[#0066ff] bg-brand-50'
                        : 'border-gray-200 hover:border-brand-300'
                    } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
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

              {/* Fees */}
              <div className="bg-gray-50 rounded-lg p-3 mb-6">
                <p className="text-xs text-gray-600 mb-2">Fee Breakdown</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Amount</span>
                    <span>{amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Service Fee (0.08%)</span>
                    <span>-{(amount * 0.0008).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-1 mt-1 font-semibold flex justify-between">
                    <span>Total</span>
                    <span>{(amount * 1.0008).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onCancel}
                  className="flex-1 border border-gray-300 text-[#0066ff] px-4 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitiatePayment}
                  disabled={!selectedMethod || loading}
                  className="flex-1 bg-[#0066ff] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#0047b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : 'Proceed'}
                </button>
              </div>
            </>
          )}

          {step === 'gateway-redirect' && (
            <div className="text-center py-8">
              <div className="animate-spin text-4xl mb-4">⟳</div>
              <p className="text-gray-600 mb-2">Redirecting to payment gateway...</p>
              <p className="text-sm text-gray-500">Do not close this window</p>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <p className="text-lg font-semibold text-[#0066ff] mb-2">
                {checkoutResult?.status === 'pending'
                  ? 'Payment Queued'
                  : 'Payment Successful!'}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {checkoutResult?.status === 'pending'
                  ? 'Insufficient balance — auto-debit has been queued.'
                  : 'Your payment has been processed.'}
              </p>
              {checkoutResult?.payment_id && (
                <p className="text-xs text-gray-500 mb-4">Ref: {checkoutResult.payment_id}</p>
              )}
              <button
                onClick={handleConfirm}
                className="w-full bg-[#0066ff] text-white px-4 py-3 rounded-lg font-semibold hover:bg-[#0047b3] transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">❌</div>
              <p className="text-lg font-semibold text-brand-600 mb-2">Payment Failed</p>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('method-selection')}
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
    </div>
  );
};

export default PaymentFlow;
