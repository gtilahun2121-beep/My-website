'use client';

import { useState } from 'react';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';
import { useEffect } from 'react';

export default function WalletPage() {
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [balance, setBalance] = useState(12500);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('telebirr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [transactions, setTransactions] = useState([
    { type: 'Payment', equb: 'Gold Equb', amount: '-ETB 5,000', date: '2024-02-10', status: '✓ Completed' },
    { type: 'Payout', equb: 'Community Fund', amount: '+ETB 8,000', date: '2024-02-05', status: '✓ Completed' },
    { type: 'Payment', equb: 'Business Support', amount: '-ETB 5,000', date: '2024-02-01', status: '✓ Completed' },
    { type: 'Deposit', equb: 'Bank Transfer', amount: '+ETB 10,000', date: '2024-01-28', status: '✓ Completed' },
  ]);

  useEffect(() => {
    if (isAuthenticated) {
      api.walletAPI.getBalance()
        .then((data) => setBalance(data.balance))
        .catch(console.error);
    }
  }, [isAuthenticated]);

  const paymentMethods = [
    { id: 'telebirr', name: 'Telebirr', icon: '📱', color: 'bg-yellow-100 border-yellow-400' },
    { id: 'cbe', name: 'CBE', icon: '🏦', color: 'bg-green-100 border-green-400' },
    { id: 'abyssinia', name: 'Abyssinia Bank', icon: '🏛️', color: 'bg-blue-100 border-blue-400' },
    { id: 'dashen', name: 'Dashen Bank', icon: '🏦', color: 'bg-red-100 border-red-400' },
    { id: 'awash', name: 'Awash Bank', icon: '🏦', color: 'bg-purple-100 border-purple-400' },
    { id: 'nib', name: 'NIB', icon: '🏦', color: 'bg-indigo-100 border-indigo-400' },
  ];

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!depositAmount || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    try {
      const res = await api.walletAPI.deposit(amount);
      setBalance(res.balance);
      setTransactions([
        { type: 'Deposit', equb: 'Bank Transfer', amount: `+ETB ${amount}`, date: new Date().toISOString().split('T')[0], status: '✓ Completed' },
        ...transactions
      ]);
      setShowDepositModal(false);
      setDepositAmount('');
    } catch (error) {
      console.error(error);
      alert('Deposit failed');
    }
  };

  const handleWithdraw = () => {
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
    
    const methodName = paymentMethods.find(m => m.id === selectedPaymentMethod)?.name || 'Bank Transfer';
    
    setBalance(balance - amount);
    setTransactions([
      { type: 'Withdrawal', equb: `${methodName} (${phoneNumber})`, amount: `-ETB ${amount}`, date: new Date().toISOString().split('T')[0], status: '✓ Completed' },
      ...transactions
    ]);
    setShowWithdrawModal(false);
    setWithdrawAmount('');
    setPhoneNumber('');
    setSelectedPaymentMethod('telebirr');
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
          <h1 className="text-4xl font-black text-gray-900 mb-8">
            {lang === 'en' ? 'Wallet 💰' : 'ዋሊት 💰'}
          </h1>

          {/* Wallet Balance */}
          <div className="bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white rounded-2xl shadow-lg p-8 mb-8">
            <p className="text-sm opacity-90">{lang === 'en' ? 'Current Balance' : 'አሁን ሚዛን'}</p>
            <h2 className="text-5xl font-black mb-4">ETB {balance.toLocaleString()}</h2>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDepositModal(true)}
                className="bg-white text-[#0d7e4d] font-bold px-6 py-2 rounded-lg hover:shadow-lg transition-all"
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
                <div key={idx} className="flex items-center justify-between border-b border-gray-200 pb-4 last:border-b-0">
                  <div>
                    <p className="font-bold text-gray-900">{txn.type}: {txn.equb}</p>
                    <p className="text-sm text-gray-500">{txn.date}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${txn.amount.includes('-') ? 'text-red-600' : 'text-green-600'}`}>
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold mb-6 text-gray-900">Deposit Funds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount (ETB)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0d7e4d]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDepositModal(false);
                    setDepositAmount('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeposit}
                  className="flex-1 px-4 py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
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
                          ? `${method.color} border-current font-bold`
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300'
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0d7e4d]"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-[#0d7e4d]"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowWithdrawModal(false);
                    setWithdrawAmount('');
                    setPhoneNumber('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  className="flex-1 px-4 py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all"
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
