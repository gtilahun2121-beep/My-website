'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { adminAPI, APIError, AdminStats, AdminRecentTransaction, AdminTopEqub } from '@/app/services/api';
import AppShell from '@/app/components/admin/AppShell';
import KpiCard from '@/app/components/admin/KpiCard';
import { StatusBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { AreaChart, DonutChart } from '@/app/components/admin/DashboardCharts';
import { ErrorState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const kpiIcon = (path: string) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
    <path d={path} />
  </svg>
);

function money(n: number | string) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatRangeDate(iso: string) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

const STATUS_TONE: Record<string, BadgeTone> = {
  paid: 'success',
  auto_debited: 'success',
  pending: 'warning',
  failed: 'danger',
};

const EQUB_TONE: Record<string, BadgeTone> = {
  open: 'info',
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
};

function statusLabel(status: string) {
  return status.replace('_', ' ').toUpperCase();
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const params =
        range === 'custom' && startDate && endDate
          ? { start: startDate, end: endDate }
          : range === 'custom'
            ? undefined
            : { range };
      const res = await adminAPI.getStats(params);
      setStats(res);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load dashboard stats.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const trend = useMemo(
    () =>
      (stats?.trend ?? []).map((p) => ({
        label: new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        value: p.count,
        detail: [
          { label: 'Registrations', value: p.registrations ?? 0 },
          { label: 'Payments', value: p.payments ?? 0 },
          { label: 'Equbs', value: p.equbs ?? 0 },
          { label: 'Joins', value: p.joins ?? 0 },
        ],
      })),
    [stats],
  );

  const paymentSegments = useMemo(() => {
    const k = stats?.kpis;
    return [
      { label: 'Successful', value: k?.successful_payments ?? 0, color: '#16a34a' },
      { label: 'Pending', value: k?.pending_payments ?? 0, color: '#f59e0b' },
      { label: 'Failed', value: k?.failed_transactions ?? 0, color: '#ef4444' },
    ];
  }, [stats]);

  const donutTotal = paymentSegments.reduce((s, seg) => s + seg.value, 0);
  const successPct =
    donutTotal > 0 ? Math.round((paymentSegments[0].value / donutTotal) * 100) : 0;

  const exportCsv = () => {
    if (!stats?.recent_transactions?.length) return;
    const rows = [
      ['User', 'Phone', 'Equb', 'Round', 'Amount (ETB)', 'Status', 'Date'],
      ...stats.recent_transactions.map((t) => [
        `${t.user_first_name} ${t.user_last_name}`,
        t.user_phone,
        t.equb_name,
        String(t.round_number),
        t.amount,
        t.status,
        t.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qalnet-recent-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const k = stats?.kpis;

  const cardCls = 'bg-admin-card rounded-card border border-admin-border';
  const cardTitleCls = 'text-base font-black text-admin-text';
  const cardSubtitleCls = 'text-xs text-admin-muted';
  const ranges: { key: '7d' | '30d' | '90d' | 'custom'; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: 'custom', label: 'Custom' },
  ];

  const rangeLabel = useMemo(() => {
    if (range === 'custom') {
      if (startDate && endDate)
        return `${formatRangeDate(startDate)} – ${formatRangeDate(endDate)}`;
      return 'pick start & end dates';
    }
    return `last ${range === '7d' ? '7 days' : range === '90d' ? '90 days' : '30 days'}`;
  }, [range, startDate, endDate]);

  const pendingActions = useMemo(() => {
    const items: { icon: string; iconClass: string; title: string; description: string; href?: string; button: string }[] = [];
    if (k) {
      if (k.pending_withdrawals > 0)
        items.push({
          icon: 'M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
          iconClass: 'bg-warning-100 text-warning-700',
          title: `${k.pending_withdrawals} withdrawal${k.pending_withdrawals > 1 ? 's' : ''} pending`,
          description: 'Awaiting admin review before payout.',
          href: '/admin/approvals',
          button: 'Review',
        });
      if (k.pending_payments > 0)
        items.push({
          icon: 'M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z',
          iconClass: 'bg-success-100 text-success-700',
          title: `${k.pending_payments} payment${k.pending_payments > 1 ? 's' : ''} awaiting settlement`,
          description: 'Scheduled contributions not yet collected.',
          button: 'Monitor',
        });
      if (k.failed_transactions > 0)
        items.push({
          icon: 'M12 8v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
          iconClass: 'bg-danger-100 text-danger-700',
          title: `${k.failed_transactions} failed transaction${k.failed_transactions > 1 ? 's' : ''}`,
          description: 'Flagged for investigation and reconciliation.',
          button: 'Investigate',
        });
    }
    return items;
  }, [k]);

  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  return (
    <AppShell title="Dashboard" subtitle="Platform overview and operational health">
      {/* ── Welcome section ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-admin-text">
            {greeting()}, Admin
          </h2>
          <p className="mt-1 text-sm text-admin-muted">
            Here&apos;s the current status of the QalNet platform.
          </p>
          <div className="mt-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-admin-card border border-admin-border text-xs font-bold text-admin-text-secondary">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-brand-600" {...stroke}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" />
              </svg>
              {new Date().toLocaleDateString('en-GB', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!stats?.recent_transactions?.length}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-bold hover:from-brand-500 hover:to-brand-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-900/40"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" {...stroke}>
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Export report
        </button>
      </div>

      {/* ── Primary KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Users"
          value={loading && !k ? '—' : (k?.total_users ?? 0)}
          hint={k ? `+${k.new_users_this_month} this month` : 'All registered accounts'}
          accent="brand"
          variant="dark"
          icon={kpiIcon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z')}
        />
        <KpiCard
          label="Active Users"
          value={loading && !k ? '—' : (k?.active_users ?? 0)}
          hint={`${k ? money(k.hosts) : '—'} of them hosts`}
          accent="success"
          variant="dark"
          icon={kpiIcon('M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z')}
        />
        <KpiCard
          label="Total Equbs"
          value={loading && !k ? '—' : (k?.total_equbs ?? 0)}
          hint={k ? `${k.active_equbs} open / ${k.operational_equbs} operational` : 'Active equb circles'}
          accent="accent"
          variant="dark"
          icon={kpiIcon('M4 21v-9m5 9v-7m5 7V4m5 17V10')}
        />
        <KpiCard
          label="Wallet Balance"
          value={loading && !k ? '—' : `ETB ${money(k?.total_wallet_balance ?? 0)}`}
          hint="Held across member wallets"
          accent="warning"
          variant="dark"
          icon={kpiIcon('M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z')}
        />
      </div>

      {/* ── Main content + right panel ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          {/* ── Platform activity chart ─────────────────────────────────── */}
          <section className={`${cardCls} p-5`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className={cardTitleCls}>Platform Activity</h3>
                <p className={cardSubtitleCls}>
                  Registrations, payments, equbs &amp; joins · {rangeLabel}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-lg border border-admin-border bg-admin-elevated p-0.5">
                  {ranges.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRange(r.key)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                        range === r.key
                          ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow'
                          : 'text-admin-muted hover:text-admin-text'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {range === 'custom' && (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-elevated p-1">
                    <input
                      type="date"
                      aria-label="Start date"
                      value={startDate}
                      max={endDate || todayIso()}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-md border border-admin-border bg-admin-card px-2 py-1 text-xs font-medium text-admin-text focus:outline-none focus:border-brand-500"
                    />
                    <span className="text-xs text-admin-muted">→</span>
                    <input
                      type="date"
                      aria-label="End date"
                      value={endDate}
                      min={startDate || undefined}
                      max={todayIso()}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-md border border-admin-border bg-admin-card px-2 py-1 text-xs font-medium text-admin-text focus:outline-none focus:border-brand-500"
                    />
                  </div>
                )}
              </div>
            </div>
            {loading && !stats ? (
              <div className="h-52 animate-pulse rounded-lg bg-admin-elevated" />
            ) : (
              <AreaChart
                data={trend}
                color="#0d9488"
                valueFormatter={(v) => String(v)}
              />
            )}
          </section>

          {/* ── Secondary KPIs ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Successful Payments"
              value={loading && !k ? '—' : (k?.successful_payments ?? 0)}
              hint="Paid or auto-debited"
              accent="success"
              variant="dark"
              icon={kpiIcon('M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z')}
            />
            <KpiCard
              label="Pending Withdrawals"
              value={loading && !k ? '—' : (k?.pending_withdrawals ?? 0)}
              hint="Awaiting payout review"
              accent="warning"
              variant="dark"
              icon={kpiIcon('M17 8l4 4m0 0-4 4m4-4H3')}
            />
            <KpiCard
              label="Failed Transactions"
              value={loading && !k ? '—' : (k?.failed_transactions ?? 0)}
              hint="Flagged for investigation"
              accent="danger"
              variant="dark"
              icon={kpiIcon('M12 8v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z')}
            />
            <KpiCard
              label="Payout Volume"
              value={loading && !k ? '—' : `ETB ${money(k?.total_payout_volume ?? 0)}`}
              hint="Approved & completed payouts"
              accent="brand"
              variant="dark"
              icon={kpiIcon('M12 3v18m0 0 4-4m-4 4-4-4')}
            />
          </div>

          {/* ── Recent transactions table ──────────────────────────────── */}
          <RecentTransactionsTable
            loading={loading}
            transactions={stats?.recent_transactions ?? []}
          />
        </div>

        {/* ── Right operational panel ────────────────────────────────────── */}
        <div className="space-y-6">
          <section className={`${cardCls} p-5`}>
            <h3 className={cardTitleCls}>Payment Health</h3>
            <p className={`${cardSubtitleCls} mb-4`}>Distribution of payment outcomes</p>
            <DonutChart
              segments={paymentSegments}
              centerTitle={donutTotal > 0 ? `${successPct}%` : '—'}
              centerSubtitle="success rate"
            />
          </section>

          <MemberVerificationCard loading={loading} stats={stats} />

          <TopEqubsCard loading={loading} equbs={stats?.top_equbs ?? []} />

          <PendingActionsCard loading={loading} items={pendingActions} />

          <QuickActionsCard />
        </div>
      </div>

      {error && !loading && (
        <ErrorState
          title="Could not load dashboard"
          description={error}
          onRetry={() => void load(true)}
          variant="dark"
        />
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Member verification
// ---------------------------------------------------------------------------

function MemberVerificationCard({
  loading,
  stats,
}: {
  loading: boolean;
  stats: AdminStats | null;
}) {
  const k = stats?.kpis;
  const verified = k?.active_users ?? 0;
  const total = Math.max(verified, k?.total_users ?? 0);
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;

  return (
    <section className="bg-admin-card rounded-card border border-admin-border p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-admin-text">Member Verification</h3>
        <span className="text-xs font-bold text-brand-600">{loading && !k ? '—' : `${pct}%`}</span>
      </div>
      <p className="text-xs text-admin-muted mb-4">Active vs registered accounts</p>

      {loading && !k ? (
        <div className="space-y-3">
          <div className="h-4 rounded-lg bg-admin-elevated animate-pulse" />
          <div className="h-4 w-2/3 rounded-lg bg-admin-elevated animate-pulse" />
        </div>
      ) : (
        <>
          <div className="h-3 rounded-full bg-admin-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-success-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs font-semibold">
            <span className="text-admin-text-secondary">{verified} verified</span>
            <span className="text-admin-muted">{total} registered</span>
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recent transactions
// ---------------------------------------------------------------------------

function RecentTransactionsTable({ loading, transactions }: { loading: boolean; transactions: AdminRecentTransaction[] }) {
  return (
    <section className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border">
        <div>
          <h3 className="text-base font-black text-admin-text">Recent Transactions</h3>
          <p className="text-xs text-admin-muted">Latest payments across all equbs</p>
        </div>
        <Link
          href="/admin/customers"
          className="text-xs font-bold text-brand-600 hover:text-brand-700"
        >
          View members →
        </Link>
      </div>

      {loading && !transactions.length ? (
        <div className="divide-y divide-admin-border-subtle">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-5 py-4">
              <div className="h-4 w-40 rounded bg-admin-elevated animate-pulse" />
              <div className="h-4 flex-1 rounded bg-admin-elevated animate-pulse" />
              <div className="h-4 w-20 rounded bg-admin-elevated animate-pulse" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-admin-muted">No transactions yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-admin-elevated text-left text-xs uppercase tracking-wider text-admin-muted">
                <th className="px-5 py-3 font-bold">Member</th>
                <th className="px-5 py-3 font-bold">Equb</th>
                <th className="px-5 py-3 font-bold">Round</th>
                <th className="px-5 py-3 font-bold text-right">Amount</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold text-right">Date</th>
                <th className="px-5 py-3 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border-subtle">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-admin-card-hover transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {`${t.user_first_name?.[0] ?? ''}${t.user_last_name?.[0] ?? ''}`.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-admin-text">
                          {t.user_first_name} {t.user_last_name}
                        </p>
                        <p className="text-xs text-admin-muted">{t.user_phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-admin-text-secondary">{t.equb_name}</td>
                  <td className="px-5 py-3 text-admin-muted">#{t.round_number}</td>
                  <td className="px-5 py-3 text-right font-bold text-admin-text">ETB {money(t.amount)}</td>
                  <td className="px-5 py-3">
                    <StatusBadge tone={STATUS_TONE[t.status] ?? 'neutral'} variant="dark">{statusLabel(t.status)}</StatusBadge>
                  </td>
                  <td className="px-5 py-3 text-right text-admin-muted whitespace-nowrap">
                    {formatDateTime(t.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <Link
                      href="/admin/customers"
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
                    >
                      View
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" {...stroke}>
                        <path d="M5 12h14m0 0-5-5m5 5-5 5" />
                      </svg>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Top equbs
// ---------------------------------------------------------------------------

function TopEqubsCard({ loading, equbs }: { loading: boolean; equbs: AdminTopEqub[] }) {
  return (
    <section className="bg-admin-card rounded-card border border-admin-border p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black text-admin-text">Top Equbs</h3>
          <p className="text-xs text-admin-muted">Largest circles by membership</p>
        </div>
        <Link href="/admin/approvals" className="text-xs font-bold text-brand-600 hover:text-brand-700">
          View all
        </Link>
      </div>

      {loading && !equbs.length ? (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-admin-elevated animate-pulse" />
          ))}
        </div>
      ) : equbs.length === 0 ? (
        <p className="py-8 text-center text-sm text-admin-muted">No equbs yet.</p>
      ) : (
        <ul className="space-y-3 mt-4">
          {equbs.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-admin-border hover:border-brand-500/40 hover:bg-admin-elevated transition-colors">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white flex items-center justify-center font-black shrink-0">
                {e.name?.[0]?.toUpperCase() ?? 'E'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-admin-text truncate">{e.name}</p>
                  <StatusBadge tone={EQUB_TONE[e.status] ?? 'neutral'} variant="dark">{statusLabel(e.status)}</StatusBadge>
                </div>
                <p className="text-xs text-admin-muted mt-0.5">
                  {e.member_count} member{e.member_count !== 1 ? 's' : ''} · round {e.current_round}/{e.total_rounds} · ETB {money(e.total_amount)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pending actions
// ---------------------------------------------------------------------------

function PendingActionsCard({
  loading,
  items,
}: {
  loading: boolean;
  items: { icon: string; iconClass: string; title: string; description: string; href?: string; button: string }[];
}) {
  return (
    <section className="bg-admin-card rounded-card border border-admin-border p-5">
      <h3 className="text-base font-black text-admin-text">Pending Actions</h3>
      <p className="text-xs text-admin-muted mb-4">Operational items needing attention</p>

      {loading && !items.length ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-admin-elevated animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8 mx-auto text-success-500" {...stroke}>
            <path d="M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z" />
          </svg>
          <p className="mt-3 text-sm font-bold text-admin-text">All caught up</p>
          <p className="mt-1 text-xs text-admin-muted">No pending actions right now.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.title} className="flex items-start gap-3 p-3 rounded-xl border border-admin-border">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.iconClass}`}>
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" {...stroke}>
                  <path d={item.icon} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-admin-text">{item.title}</p>
                <p className="text-xs text-admin-muted mt-0.5">{item.description}</p>
              </div>
              {item.href ? (
                <Link
                  href={item.href}
                  className="px-3 py-1.5 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold hover:bg-brand-200 transition-colors shrink-0"
                >
                  {item.button}
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg bg-admin-elevated text-admin-muted text-xs font-bold shrink-0">
                  {item.button}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

function QuickActionsCard() {
  const actions: { label: string; href?: string; icon: string; disabled?: boolean }[] = [
    {
      label: 'Manage Users',
      href: '/admin/customers',
      icon: 'M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z',
    },
    {
      label: 'View Reports',
      icon: 'M5 20V10m7 10V4m7 16v-7',
      disabled: true,
    },
  ];

  return (
    <section className="bg-admin-card rounded-card border border-admin-border p-5">
      <h3 className="text-base font-black text-admin-text">Quick Actions</h3>
      <p className="text-xs text-admin-muted mb-4">Common administrative tasks</p>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) =>
          action.disabled ? (
            <div
              key={action.label}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-admin-border-strong py-5 text-admin-disabled cursor-not-allowed"
              title="Coming soon"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
                <path d={action.icon} />
              </svg>
              <span className="text-xs font-bold">{action.label}</span>
            </div>
          ) : action.href ? (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-admin-border py-5 text-admin-text-secondary hover:text-brand-600 hover:border-brand-500/40 hover:bg-admin-elevated hover:shadow-lg hover:shadow-brand-900/10 transition-all"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
                <path d={action.icon} />
              </svg>
              <span className="text-xs font-bold">{action.label}</span>
            </Link>
          ) : null,
        )}
      </div>
    </section>
  );
}
