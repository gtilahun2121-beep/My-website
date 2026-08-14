'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { EqubGroup, Wallet, WalletTransaction, Notification } from '@qalnet/shared-types';
import AppShell from '@/app/components/admin/AppShell';
import DashboardHeader from '@/app/components/dashboard/DashboardHeader';
import FinancialSummary from '@/app/components/dashboard/FinancialSummary';
import MyEqubs from '@/app/components/dashboard/MyEqubs';
import ImportantAlerts from '@/app/components/dashboard/ImportantAlerts';
import QuickActions from '@/app/components/dashboard/QuickActions';
import RecentActivity from '@/app/components/dashboard/RecentActivity';
import UpcomingPayments from '@/app/components/dashboard/UpcomingPayments';
import HelpCard from '@/app/components/dashboard/HelpCard';
import { useAuth } from '@/app/context/AuthContext';
import api from '@/app/services/api';

interface DashboardData {
  equbs: EqubGroup[];
  wallet: Wallet | null;
  transactions: WalletTransaction[];
  notifications: Notification[];
  error: string | null;
}

export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({
    equbs: [],
    wallet: null,
    transactions: [],
    notifications: [],
    error: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }
    // Admins belong on the admin console, not the member dashboard.
    if (user?.role === 'admin') {
      router.replace('/admin/dashboard');
      return;
    }

    let cancelled = false;

    Promise.allSettled([
      api.equbAPI.getMine(),
      api.walletAPI.getBalance(),
      api.walletAPI.getTransactions(),
      api.notificationsAPI.getNotifications(),
    ]).then(([equbsRes, walletRes, txnRes, notifRes]) => {
      if (cancelled) return;
      setData({
        equbs:
          equbsRes.status === 'fulfilled' ? equbsRes.value : [],
        wallet: walletRes.status === 'fulfilled' ? walletRes.value : null,
        transactions: txnRes.status === 'fulfilled' ? txnRes.value : [],
        notifications: notifRes.status === 'fulfilled' ? notifRes.value : [],
        error:
          equbsRes.status === 'rejected' &&
          equbsRes.reason instanceof Error
            ? equbsRes.reason.message
            : null,
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated, user?.role, router]);

  if (isLoading) {
    return (
      <div className="dark-navy min-h-screen flex items-center justify-center bg-surface">
        <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const totalSaved =
    data.transactions
      .filter((t) => t.direction === 'payment' && (t.status === 'paid' || t.status === 'auto_debited'))
      .reduce((sum, t) => sum + Number(t.amount), 0) || null;

  const memberEqubs = data.equbs.filter((e) => e.status === 'active' || e.status === 'open');
  const nextUpcoming = [...memberEqubs].sort((a, b) => a.contribution_amount - b.contribution_amount)[0];
  const nextPayment = nextUpcoming
    ? {
        amount: nextUpcoming.contribution_amount,
        label: `${nextUpcoming.name} · Round ${Math.min(nextUpcoming.current_round + 1, nextUpcoming.total_rounds)}`,
      }
    : null;

  const isNewUser = data.equbs.length === 0;

  return (
    <AppShell
      title="Member Dashboard"
      subtitle="Manage your Equbs, payments, and wallet"
      variant="member"
    >
      <DashboardHeader firstName={user.firstName} isNewUser={isNewUser} />

      <FinancialSummary
        balance={data.wallet?.balance ?? null}
        totalSaved={totalSaved}
        activeEqubs={memberEqubs.length}
        nextPayment={nextPayment}
        loading={loading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MyEqubs equbs={data.equbs} loading={loading} error={data.error} />
          <QuickActions />
        </div>

        <div className="space-y-6">
          <ImportantAlerts notifications={data.notifications} />
          <UpcomingPayments equbs={data.equbs} loading={loading} />
          <RecentActivity transactions={data.transactions} loading={loading} />
        </div>
      </div>

      <HelpCard />
    </AppShell>
  );
}
