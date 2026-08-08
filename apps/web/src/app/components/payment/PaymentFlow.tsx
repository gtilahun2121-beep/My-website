// ========================================================================
// PAYMENT FLOW COMPONENT
// Handles Payment Initiation, Gateway Checkout, and Confirmation
// ========================================================================

'use client';

import React, { useState } from 'react';
import { Payment } from '../../data';
import { paymentsAPI } from '../../services/api';

interface PaymentFlowProps {
  equbId: string;
  roundNumber: number;
  amount: number;
  onSuccess: (payment: Payment) => void;
  onCancel: () => void;
  language: 'en' | 'am' | 'om' | 'ti';
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
  const [selectedMethod, setSelectedMethod] = useState<'telebirr' | 'cbe' | 'wallet' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionRef, setTransactionRef] = useState<string | null>(null);

  const paymentMethods = [
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
      id: 'cbe',
      name: 'CBE Bank',
      description: 'Direct CBE bank transfer',
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
        amount,
        payment_method: selectedMethod,
      });
      setTransactionRef(result.payment_id ?? result.paymentId ?? null);

      if (selectedMethod === 'wallet') {
        // Wallet payments resolve immediately
        await processWalletPayment(result.payment_id ?? result.paymentId);
      } else {
        // Redirect to external gateway
        setStep('gateway-redirect');
        if (result.gateway_url || result.gatewayUrl) {
          window.location.href = result.gateway_url ?? result.gatewayUrl;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment initiation failed');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const processWalletPayment = async (_paymentId: string) => {
    // NOTE: /payments/:id/verify does not exist in the backend.
    // Wallet payments are confirmed synchronously by the checkout endpoint.
    // Status updates arrive via the /payments/webhook endpoint (server-side).
    try {
      setStep('confirmation');
      setTimeout(() => onSuccess({} as any), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment processing failed');
      setStep('error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-emerald-600 text-white p-4 flex justify-between items-center">
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
              <div className="bg-emerald-50 rounded-lg p-4 mb-6 text-center">
                <p className="text-sm text-gray-600 mb-1">Amount to Pay</p>
                <p className="text-4xl font-bold text-emerald-600">
                  {amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-600 mt-1">ETB</p>
              </div>

              {/* Payment Methods */}
              <p className="font-semibold text-gray-900 mb-4">Select Payment Method</p>
              <div className="space-y-3 mb-6">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedMethod(method.id as any)}
                    disabled={!method.available}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedMethod === method.id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-gray-200 hover:border-emerald-300'
                    } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{method.icon}</span>
                      <div>
                        <p className="font-semibold text-gray-900">{method.name}</p>
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
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInitiatePayment}
                  disabled={!selectedMethod || loading}
                  className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              <p className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</p>
              <p className="text-sm text-gray-600 mb-4">
                Your payment has been processed. Your membership is now active.
              </p>
              {transactionRef && (
                <p className="text-xs text-gray-500 mb-4">Ref: {transactionRef}</p>
              )}
              <button
                onClick={() => onSuccess({ id: transactionRef || '', userId: '', equbId, roundNumber, amount, feeDeducted: amount * 0.0008, hostCommissionDeducted: amount * 0.0002, paymentStatus: 'paid', transactionReference: transactionRef || '', paidAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })}
                className="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">❌</div>
              <p className="text-lg font-semibold text-red-600 mb-2">Payment Failed</p>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('method-selection')}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
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
