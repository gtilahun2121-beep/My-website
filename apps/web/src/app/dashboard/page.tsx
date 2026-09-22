'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EqubCreationRequest, EqubGroup, Wallet, WalletTransaction, Notification } from '@qalnet/shared-types';
import { useAuth } from '@/app/context/AuthContext';
import api from '@/app/services/api';
import AppShell from '@/app/components/admin/AppShell';
import DashboardHeader from '@/app/components/dashboard/DashboardHeader';
import FinancialSummary from '@/app/components/dashboard/FinancialSummary';
import QuickActions from '@/app/components/dashboard/QuickActions';
import MyEqubs from '@/app/components/dashboard/MyEqubs';
import UpcomingPayments from '@/app/components/dashboard/UpcomingPayments';
import RecentActivity from '@/app/components/dashboard/RecentActivity';
import ImportantAlerts from '@/app/components/dashboard/ImportantAlerts';
import LotterySection from '@/app/components/dashboard/LotterySection';
import HelpCard from '@/app/components/dashboard/HelpCard';
import { trustTierLabel } from '@/app/components/dashboard/format';

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational bits
// ─────────────────────────────────────────────────────────────────────────────

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function WalletHero({ balance, trustTier }: { balance: number; trustTier: string }) {
  return (
    <section className="relative overflow-hidden rounded-card bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-4 sm:p-5 text-white shadow-lg shadow-brand-600/20">
      {/* decorative glow rings */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full border-[20px] border-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full border-[26px] border-white/5"
      />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-brand-100">Available Balance</p>
          <p className="mt-0.5 text-2xl sm:text-3xl font-black tracking-tight">
            ETB {balance.toLocaleString('en-US')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
          {trustTierLabel(trustTier)}
        </span>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link
            href="/wallet"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-black text-brand-700 shadow transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" {...stroke}>
              <path d="M12 5v14m-7-7h14" />
            </svg>
            Deposit
          </Link>
          <Link
            href="/wallet"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" {...stroke}>
              <path d="M12 19V5m-7 7 7-7 7 7" />
            </svg>
            Withdraw
          </Link>
          <Link
            href="/my-equbs"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" {...stroke}>
              <path d="M17 21v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4M7 4h10a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2Zm2 6h6" />
            </svg>
            My Equbs
          </Link>
        </div>
      </div>
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-danger-200 bg-danger-50 p-4 text-sm font-semibold text-danger-700">
      {message}
    </div>
  );
}

function PendingReviews({
  equbs,
  requests,
}: {
  equbs: EqubGroup[];
  requests: EqubCreationRequest[];
}) {
  const pendingMemberships = equbs.filter((e) => e.membership_status === 'pending');
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const total = pendingMemberships.length + pendingRequests.length;

  if (total === 0) return null;

  return (
    <section className="rounded-card border border-warning-200 bg-warning-50/70 p-5">
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-warning-700" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <h2 className="text-base font-black text-warning-700">
          Waiting on admin approval
        </h2>
      </div>
      <p className="mt-1 text-sm text-warning-800/80">
        {total} item{total === 1 ? '' : 's'} await review — your equbs light up as soon as the
        admin approves them.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {pendingMemberships.map((e) => (
          <span
            key={`m-${e.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-warning-200 bg-white/60 px-3 py-1.5 text-xs font-bold text-warning-800"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z" />
            </svg>
            Join {e.name}
          </span>
        ))}
        {pendingRequests.map((r) => (
          <span
            key={`r-${r.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-warning-200 bg-white/60 px-3 py-1.5 text-xs font-bold text-warning-800"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14m-7-7h14" />
            </svg>
            Create {r.name}
          </span>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Member dashboard page
// ─────────────────────────────────────────────────────────────────────────────

export default function MemberDashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [equbs, setEqubs] = useState<EqubGroup[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [requests, setRequests] = useState<EqubCreationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect unauthenticated visitors to the sign-in/home page.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;

    Promise.all([
      api.equbAPI.getMine().catch(() => [] as EqubGroup[]),
      api.walletAPI.getBalance().catch(() => null),
      api.walletAPI.getTransactions().catch(() => [] as WalletTransaction[]),
      api.notificationsAPI.getNotifications().catch(() => [] as Notification[]),
      api.equbAPI.getMyRequests().catch(() => [] as EqubCreationRequest[]),
    ])
      .then(([eq, wl, tx, al, rq] : [EqubGroup[], Wallet | null, WalletTransaction[], Notification[], EqubCreationRequest[]]) => {
        setEqubs(eq);
        setWallet(wl);
        setTransactions(tx);
        setNotifications(al);
        setRequests(rq);
        setError(null);
      })
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const stats = useMemo(() => {
    const active = equbs.filter((e) => e.status === 'active' || e.status === 'open');
    const totalSaved = transactions
      .filter((t) => t.direction === 'payment')
      .reduce((sum, t) => sum + t.amount, 0);
    const next = active[0] ?? null;
    return {
      activeCount: active.length,
      totalSaved,
      nextPayment: next
        ? {
            amount: next.contribution_amount,
            label: `Round ${Math.min(next.current_round + 1, next.total_rounds)} of ${next.total_rounds}`,
          }
        : null,
    };
  }, [equbs, transactions]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  const isNewUser = !!user && equbs.length === 0;

  return (
    <AppShell
      title="Member Dashboard"
      subtitle="Your Equbs, wallet and recent activity at a glance"
      variant="member"
    >
      <div className="space-y-4">
        <DashboardHeader firstName={user?.firstName ?? ''} isNewUser={isNewUser} />

        {error && <ErrorBanner message={error} />}

        <WalletHero balance={wallet?.balance ?? 0} trustTier={user?.trustTier ?? 'standard'} />

        <FinancialSummary
          totalSaved={stats.totalSaved}
          activeEqubs={stats.activeCount}
          nextPayment={stats.nextPayment}
          loading={loading}
        />

        <PendingReviews equbs={equbs} requests={requests} />

<div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-3">
            <QuickActions />
            <MyEqubs equbs={equbs} loading={loading} error={error} />
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <UpcomingPayments equbs={equbs} loading={loading} />
            <ImportantAlerts notifications={notifications} />
            <LotterySection equbs={equbs} loading={loading} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <RecentActivity transactions={transactions} loading={loading} />
          <HelpCard />
        </div>
      </div>
    </AppShell>
  );
}