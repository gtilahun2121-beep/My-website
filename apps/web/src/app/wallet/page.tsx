'use client';

import { useState } from 'react';
import { Language, defaultLanguage } from '@/i18n/config';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api, { APIError } from '@/app/services/api';
import { useEffect } from 'react';
import type { WalletTransaction } from '@qalnet/shared-types';
import Withdrawal from '@/app/components/withdrawal/Withdrawal';

interface TxnRow {
  id: string;
  type: string;
  equb: string;
  amount: string;
  date: string;
  status: string;
}

export default function WalletPage() {
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [balance, setBalance] = useState(0);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPin, setDepositPin] = useState('');
  const [transactions, setTransactions] = useState<TxnRow[]>([]);

  const refreshTransactions = () => {
    api.walletAPI
      .getTransactions()
      .then((txns) => setTransactions(txns.map(mapTxn)))
      .catch(console.error);
  };

  const mapTxn = (txn: WalletTransaction): TxnRow => {
    const outgoing = txn.direction === 'payment' || txn.direction === 'withdrawal';
    const amount = `${outgoing ? '-' : '+'}ETB ${txn.amount.toLocaleString('en-US')}`;
    
    // Handle date safely - check if it's a valid date string
    let date = 'N/A';
    try {
      const parsedDate = new Date(txn.created_at);
      if (!isNaN(parsedDate.getTime())) {
        date = parsedDate.toISOString().split('T')[0];
      } else if (typeof txn.created_at === 'string') {
        // If it looks like a date string already, use it directly
        date = txn.created_at.split('T')[0] || txn.created_at;
      }
    } catch {
      // Fallback to current date
      date = new Date().toISOString().split('T')[0];
    }
    
    const type =
      txn.direction === 'payment'
        ? 'Payment'
        : txn.direction === 'payout'
          ? 'Payout'
          : txn.direction === 'deposit'
            ? 'Deposit'
            : 'Withdrawal';
    return {
      id: txn.id,
      type,
      equb: txn.equb_name,
      amount,
      date,
      status: txn.status,
    };
  };

  useEffect(() => {
    if (isAuthenticated) {
      api.walletAPI
        .getBalance()
        .then((data) => setBalance(data.balance))
        .catch(console.error);
      api.walletAPI
        .getTransactions()
        .then((txns) => setTransactions(txns.map(mapTxn)))
        .catch(console.error);
    }
  }, [isAuthenticated]);

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!depositAmount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (!depositPin) {
      alert('Please enter your PIN');
      return;
    }
    
    try {
      const res = await api.walletAPI.deposit(amount, depositPin);
      setBalance(res.balance);
      setShowDepositModal(false);
      setDepositAmount('');
      setDepositPin('');
      refreshTransactions();
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof APIError ? error.data?.message : undefined;
      alert(message === 'Invalid PIN.' ? 'Invalid PIN' : 'Deposit failed');
    }
  };

  const handleWithdrawSuccess = () => {
    setShowWithdrawModal(false);
    refreshTransactions();
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-bold">{lang === 'en' ? 'Please log in' : 'ግባ'}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header lang={lang} onLanguageChange={setLang} isAuthenticated={true} />

      <div className="flex-grow py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-[#00d9ff] mb-8">
            {lang === 'en' ? 'Wallet' : 'ዋሊት'}
          </h1>

          {/* Wallet Balance */}
          <div className="bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] rounded-2xl shadow-lg p-6 sm:p-8 mb-8">
            <p className="text-sm opacity-90">{lang === 'en' ? 'Current Balance' : 'አሁን ሚዛን'}</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 break-all">
              ETB {balance.toLocaleString()}
            </h2>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setShowDepositModal(true)}
                className="bg-white text-[#00d9ff] font-bold px-6 py-2 rounded-lg hover:shadow-lg transition-all"
              >
                {lang === 'en' ? 'Deposit' : 'ተወገዱ'}
              </button>
              <button 
                onClick={() => setShowWithdrawModal(true)}
              className="bg-white text-[#00d9ff] font-bold px-6 py-2 rounded-lg hover:bg-gray-100 transition-all"
              >
                {lang === 'en' ? 'Withdraw' : 'ዘግቡ'}
              </button>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-[#00d9ff] mb-6">
              {lang === 'en' ? 'Transaction History' : 'ተግባር ታሪክ'}
            </h2>
            <div className="space-y-4">
              {transactions.map((txn, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="min-w-0">
                    <p className="font-bold text-[#00d9ff] truncate">{txn.type}: {txn.equb}</p>
                    <p className="text-sm text-gray-500">{txn.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-lg whitespace-nowrap ${txn.amount.includes('-') ? 'text-brand-600' : 'text-brand-600'}`}>
                      {txn.amount}
                    </p>
                    <p className="text-xs text-brand-600">{txn.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Withdraw Section — inline within the wallet interface */}
          {showWithdrawModal && (
            <div className="py-6">
              <Withdrawal
                balance={balance}
                onSuccess={handleWithdrawSuccess}
                onCancel={() => {
                  setShowWithdrawModal(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold mb-6 text-[#00d9ff]">Deposit Funds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#00d9ff] mb-2">Amount (ETB)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#001f3f]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#00d9ff] mb-2">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={depositPin}
                  onChange={(e) => setDepositPin(e.target.value)}
                  placeholder="Enter your PIN"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#001f3f]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDepositModal(false);
                    setDepositAmount('');
                    setDepositPin('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-[#00d9ff] font-bold rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeposit}
                  className="flex-1 px-4 py-3 bg-[#001f3f] text-[#00d9ff] font-bold rounded-lg hover:bg-[#001f3f] hover:text-[#00d9ff] transition-all"
                >
                  Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer lang={lang} />
    </main>
  );
}
