'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import DepositForm from '../components/DepositForm';

interface DepositFormData {
  phone: string;
  pin: string;
  amount: string;
  paymentMethod: string;
}

export default function DepositPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleDepositSubmit = async (data: DepositFormData) => {
    setIsLoading(true);
    try {
      // Simulate API call
      const response = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          phone: data.phone,
          pin: data.pin,
          amount: parseFloat(data.amount),
          paymentMethod: data.paymentMethod,
        }),
      });

      if (!response.ok) {
        throw new Error('Deposit failed');
      }

      const result = await response.json();
      
      // Redirect to wallet after successful deposit
      setTimeout(() => {
        router.push('/wallet?success=deposit');
      }, 2000);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 md:py-12">
      {/* Header */}
      <div className="max-w-md mx-auto px-4 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm md:text-base">Back</span>
        </button>
      </div>

      {/* Main Content */}
      <DepositForm
        onSubmit={handleDepositSubmit}
        onCancel={() => router.back()}
        isLoading={isLoading}
      />

      {/* Footer */}
      <div className="max-w-md mx-auto px-4 mt-8 text-center text-gray-600 text-xs md:text-sm">
        <p>Need help? <a href="/support" className="text-brand-600 hover:underline">Contact support</a></p>
      </div>
    </div>
  );
}
