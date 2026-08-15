'use client';

import { useState } from 'react';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api, { APIError } from '@/app/services/api';
import { useEffect } from 'react';
import type { WalletTransaction } from '@qalnet/shared-types';

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
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('telebirr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [depositPin, setDepositPin] = useState('');
  const [withdrawPin, setWithdrawPin] = useState('');
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
    const date = new Date(txn.created_at).toISOString().split('T')[0];
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
      status: `✓ ${txn.status}`,
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

  const paymentMethods = [
    { id: 'telebirr', name: 'Telebirr', icon: '📱', color: 'bg-slate-100 border-slate-300' },
    { id: 'cbe', name: 'CBE', icon: '🏦', color: 'bg-slate-100 border-slate-300' },
    { id: 'abyssinia', name: 'Abyssinia Bank', icon: '🏛️', color: 'bg-slate-100 border-slate-300' },
    { id: 'dashen', name: 'Dashen Bank', icon: '🏦', color: 'bg-slate-100 border-slate-300' },
    { id: 'awash', name: 'Awash Bank', icon: '🏦', color: 'bg-slate-100 border-slate-300' },
    { id: 'nib', name: 'NIB', icon: '🏦', color: 'bg-slate-100 border-slate-300' },
  ];

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

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!withdrawAmount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    if (amount > balance) {
      alert('Insufficient balance');
      return;
    }
    if (!phoneNumber) {
      alert('Please enter phone number');
      return;
    }
    if (!withdrawPin) {
      alert('Please enter your PIN');
      return;
    }

    const methodName = paymentMethods.find(m => m.id === selectedPaymentMethod)?.id || 'bank_transfer';

    try {
      const res = await api.walletAPI.withdraw(amount, methodName, phoneNumber, withdrawPin);
      setBalance(res.balance);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      setPhoneNumber('');
      setWithdrawPin('');
      setSelectedPaymentMethod('telebirr');
      refreshTransactions();
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof APIError ? error.data?.message : undefined;
      alert(message === 'Invalid PIN.' ? 'Invalid PIN' : 'Withdrawal failed');
    }
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
          <h1 className="text-3xl sm:text-4xl font-black text-[#314fa0] mb-8">
            {lang === 'en' ? 'Wallet 💰' : 'ዋሊት 💰'}
          </h1>

          {/* Wallet Balance */}
          <div className="bg-gradient-to-r from-[#314fa0] to-[#2a4183] text-white rounded-2xl shadow-lg p-6 sm:p-8 mb-8">
            <p className="text-sm opacity-90">{lang === 'en' ? 'Current Balance' : 'አሁን ሚዛን'}</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 break-all">
              ETB {balance.toLocaleString()}
            </h2>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setShowDepositModal(true)}
                className="bg-white text-[#314fa0] font-bold px-6 py-2 rounded-lg hover:shadow-lg transition-all"
              >
                {lang === 'en' ? 'Deposit' : 'ተወገዱ'}
              </button>
              <button 
                onClick={() => setShowWithdrawModal(true)}
                className="bg-white/20 text-white font-bold px-6 py-2 rounded-lg hover:bg-white/30 transition-all"
              >
                {lang === 'en' ? 'Withdraw' : 'ዘግቡ'}
              </button>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {lang === 'en' ? 'Transaction History' : 'ተግባር ታሪክ'}
            </h2>
            <div className="space-y-4">
              {transactions.map((txn, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 border-b border-gray-200 pb-4 last:border-b-0">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 truncate">{txn.type}: {txn.equb}</p>
                    <p className="text-sm text-gray-500">{txn.date}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-lg whitespace-nowrap ${txn.amount.includes('-') ? 'text-red-600' : 'text-green-600'}`}>
                      {txn.amount}
                    </p>
                    <p className="text-xs text-green-600">{txn.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-form rounded-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold mb-6 text-gray-900">Deposit Funds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (ETB)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#314fa0]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={depositPin}
                  onChange={(e) => setDepositPin(e.target.value)}
                  placeholder="Enter your PIN"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#314fa0]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDepositModal(false);
                    setDepositAmount('');
                    setDepositPin('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeposit}
                  className="flex-1 px-4 py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all"
                >
                  Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-form rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-6 text-gray-900">Withdraw Funds</h3>
            <div className="space-y-4">
              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedPaymentMethod(method.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-center ${
                        selectedPaymentMethod === method.id
                          ? 'bg-[#314fa0]/10 border-[#314fa0] text-[#314fa0] font-bold'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-2xl mb-1">{method.icon}</p>
                      <p className="text-xs font-semibold">{method.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {selectedPaymentMethod === 'telebirr' ? 'Telebirr Phone' : 'Account Phone Number'}
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+2519xxxxxxxx"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#314fa0]"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (ETB)</label>
                <p className="text-xs text-gray-500 mb-2">Available: ETB {balance.toLocaleString()}</p>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#314fa0]"
                />
              </div>

              {/* PIN */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={withdrawPin}
                  onChange={(e) => setWithdrawPin(e.target.value)}
                  placeholder="Enter your PIN"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#314fa0]"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawAmount('');
                    setPhoneNumber('');
                    setWithdrawPin('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  className="flex-1 px-4 py-3 bg-[#314fa0] text-white font-bold rounded-lg hover:bg-[#2a4183] transition-all"
                >
                  Withdraw
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
