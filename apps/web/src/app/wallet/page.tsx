'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/admin/AppShell';
import { StatusBadge, type BadgeTone } from '@/app/components/admin/StatusBadge';
import { Withdrawal } from '@/app/components/withdrawal/Withdrawal';
import { useAuth } from '@/app/context/AuthContext';
import { walletAPI, APIError } from '@/app/services/api';
import type { WalletTransaction } from '@qalnet/shared-types';

interface TransactionFilter {
  type: 'all' | 'deposit' | 'payment' | 'payout' | 'withdrawal';
  status: 'all' | 'completed' | 'pending' | 'failed';
  dateRange: 'all' | '7days' | '30days' | '90days';
}

function WalletPageContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const action = searchParams?.get('action');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<TransactionFilter>({
    type: 'all',
    status: 'all',
    dateRange: 'all',
  });

  // Open the matching form when arriving via `?action=deposit|withdraw`
  const [showDepositModal, setShowDepositModal] = useState(action === 'deposit');
  const [showWithdrawModal, setShowWithdrawModal] = useState(action === 'withdraw');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPin, setDepositPin] = useState('');
  const [depositing, setDepositing] = useState(false);

  const refreshWallet = async () => {
    const data = await walletAPI.getBalance();
    setBalance(data.balance || 0);

    const txns = await walletAPI.getTransactions();
    setTransactions(txns || []);
  };

  // Load wallet data
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const loadWallet = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await walletAPI.getBalance();
        setBalance(data.balance || 0);
        
        const txns = await walletAPI.getTransactions();
        setTransactions(txns || []);
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.data?.message || err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load wallet';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadWallet();
  }, [isAuthenticated, isLoading]);

  // Apply filters
  useEffect(() => {
    let result = [...transactions];

    // Type filter
    if (filters.type !== 'all') {
      result = result.filter(t => t.direction === filters.type);
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(t => t.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const days = filters.dateRange === '7days' ? 7 : filters.dateRange === '30days' ? 30 : 90;
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      result = result.filter(t => {
        try {
          const txnDate = new Date(t.created_at);
          return txnDate >= cutoffDate;
        } catch {
          return false;
        }
      });
    }

    // Sort by date descending
    result.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateB - dateA;
    });

    setFilteredTransactions(result);
  }, [transactions, filters]);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (!depositPin) {
      setError('Please enter your PIN');
      return;
    }

    setDepositing(true);
    setError(null);
    try {
      const result = await walletAPI.deposit(parseFloat(depositAmount), depositPin);
      setBalance(result.balance);
      setShowDepositModal(false);
      setDepositAmount('');
      setDepositPin('');

      await refreshWallet();
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Deposit failed';
      setError(message);
    } finally {
      setDepositing(false);
    }
  };

  const getTxnIcon = (direction: string) => {
    switch (direction) {
      case 'deposit': return '⬇️';
      case 'payment': return '➡️';
      case 'payout': return '⬆️';
      case 'withdrawal': return '⬆️';
      default: return '💱';
    }
  };

  const getTxnTypeLabel = (direction: string) => {
    switch (direction) {
      case 'deposit': return 'Deposit';
      case 'payment': return 'Payment';
      case 'payout': return 'Payout';
      case 'withdrawal': return 'Withdrawal';
      default: return 'Transaction';
    }
  };

  const getTxnStatusTone = (status: string): BadgeTone => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'neutral';
    }
  };

  // Calculate stats
  const totalIn = filteredTransactions
    .filter(t => t.direction === 'deposit' || t.direction === 'payout')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalOut = filteredTransactions
    .filter(t => t.direction === 'payment' || t.direction === 'withdrawal')
    .reduce((sum, t) => sum + t.amount, 0);

  if (isLoading || loading) {
    return (
      <AppShell title="My Wallet" subtitle="Manage funds and view transaction history" variant="member">
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AppShell title="My Wallet" subtitle="Manage funds and view transaction history" variant="member">
      <div className="space-y-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-lg shadow-md p-6">
          <p className="text-sm opacity-90 mb-2">Current Balance</p>
          <h2 className="text-4xl font-bold mb-6">ETB {balance.toLocaleString('en-US')}</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowDepositModal(true)}
              className="bg-white text-brand-600 font-semibold px-6 py-2 rounded-lg hover:bg-gray-100 transition-all"
            >
              Deposit Funds
            </button>
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="border border-white/60 bg-white/10 text-white font-semibold px-6 py-2 rounded-lg hover:bg-white/15 transition-all"
            >
              Withdraw Funds
            </button>
          </div>
        </div>

        {showWithdrawModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <div className="max-w-lg w-full">
              <Withdrawal
                balance={balance}
                onCancel={() => setShowWithdrawModal(false)}
                onSuccess={async () => {
                  setShowWithdrawModal(false);
                  await refreshWallet();
                }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Transaction Analytics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600 font-semibold">Total In</p>
            <p className="text-2xl font-bold text-green-700">ETB {totalIn.toLocaleString('en-US')}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-600 font-semibold">Total Out</p>
            <p className="text-2xl font-bold text-red-700">ETB {totalOut.toLocaleString('en-US')}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-gray-900">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Type</label>
              <select 
                value={filters.type}
                onChange={(e) => setFilters({...filters, type: e.target.value as TransactionFilter['type']})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposits</option>
                <option value="payment">Payments</option>
                <option value="payout">Payouts</option>
                <option value="withdrawal">Withdrawals</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
              <select 
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value as TransactionFilter['status']})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Date Range</label>
              <select 
                value={filters.dateRange}
                onChange={(e) => setFilters({...filters, dateRange: e.target.value as TransactionFilter['dateRange']})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Time</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Transaction History ({filteredTransactions.length})</h3>
          </div>
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No transactions found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getTxnIcon(txn.direction)}</span>
                          <span className="text-sm font-medium text-gray-900">{getTxnTypeLabel(txn.direction)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        <span className={txn.direction === 'deposit' || txn.direction === 'payout' ? 'text-green-600' : 'text-red-600'}>
                          {txn.direction === 'deposit' || txn.direction === 'payout' ? '+' : '-'}ETB {txn.amount.toLocaleString('en-US')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(txn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={getTxnStatusTone(txn.status)}>
                          {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Deposit Funds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (ETB)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={depositPin}
                  onChange={(e) => setDepositPin(e.target.value)}
                  placeholder="Enter your PIN"
                  maxLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDepositModal(false);
                    setDepositAmount('');
                    setDepositPin('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 font-medium rounded-lg hover:bg-gray-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={depositing}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-all disabled:opacity-50"
                >
                  {depositing ? 'Processing...' : 'Deposit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <WalletPageContent />
    </Suspense>
  );
}
