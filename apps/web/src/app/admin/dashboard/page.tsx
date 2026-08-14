'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { adminAPI, APIError, AdminStats, AdminRecentTransaction, AdminTopEqub } from '@/app/services/api';
import type { PendingMembership } from '@/app/services/api';
import type { EqubCreationRequest } from '@qalnet/shared-types';
import KpiCard from '@/app/components/admin/KpiCard';
import { StatusBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { AreaChart } from '@/app/components/admin/DashboardCharts';import { ErrorState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';
import { useAuth } from '@/app/context/AuthContext';
import { initials } from '@/app/components/dashboard/format';

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

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} hr ago`;
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
  open: 'success',
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
};

function statusLabel(status: string) {
  return status.replace('_', ' ').toUpperCase();
}

interface PendingApprovalRow {
  type: string;
  name: string;
  category: string;
  date: string;
  icon: string;
  iconClass: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [approvals, setApprovals] = useState<PendingApprovalRow[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const params =
        range === 'custom' && startDate && endDate
          ? { start: startDate, end: endDate }
          : range === 'custom'
            ? undefined
            : { range };
      const res = await adminAPI.getStats(params);
      setApiLatency(Math.round(performance.now() - t0));
      setStats(res);
      setLastUpdated(new Date());
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

  const loadApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      const [reqs, mems] = await Promise.all([
        adminAPI.listEqubRequests(),
        adminAPI.listPendingMemberships(),
      ]);
      const rows: PendingApprovalRow[] = [
        ...reqs.map((r: EqubCreationRequest) => ({
          type: 'Equb Registration',
          name: r.name,
          category: 'Equb',
          date: r.created_at,
          icon: 'M4 21v-9m5 9v-7m5 7V4m5 17V10',
          iconClass: 'bg-accent-100 text-accent-600',
        })),
        ...mems.map((m: PendingMembership) => ({
          type: 'New Member',
          name: `${m.user_first_name} ${m.user_last_name}`.trim(),
          category: 'Member',
          date: m.joined_at,
          icon: 'M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z',
          iconClass: 'bg-blue-100 text-blue-500',
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setApprovals(rows);
    } catch {
      setApprovals([]);
    } finally {
      setApprovalsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadApprovals(), 0);
    return () => clearTimeout(t);
  }, [loadApprovals]);

  /* Close export menu on outside click / Escape */
  useEffect(() => {
    if (!exportOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

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

  const k = stats?.kpis;

  const activitySummary = useMemo(() => {
    const now = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayStr = iso(now);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const pts = stats?.trend ?? [];
    const total = pts.reduce((s, p) => s + p.count, 0);
    return {
      today: pts.find((p) => p.date === todayStr)?.count ?? 0,
      week: pts.filter((p) => new Date(p.date + 'T00:00:00') >= weekAgo).reduce((s, p) => s + p.count, 0),
      month: pts.filter((p) => new Date(p.date + 'T00:00:00') >= monthStart).reduce((s, p) => s + p.count, 0),
      allTime: k?.total_users ?? total,
    };
  }, [stats, k]);

  const txGrowth = useMemo(() => {
    const cur = k?.transactions_30d ?? 0;
    const prev = k?.transactions_prev_30d ?? 0;
    if (prev <= 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  }, [k]);

  const storagePct = useMemo(() => {
    const bytes = k?.db_size_bytes ?? 0;
    const quota = 1024 ** 4; // 1 TB
    return { pct: quota > 0 ? Math.min(100, (bytes / quota) * 100) : 0, gb: bytes / 1024 ** 3 };
  }, [k]);

  const adminInitials = user ? initials(user.firstName, user.lastName) : 'A';

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

  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  return (
    <>
      {/* ── Greeting + date + export ─────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-admin-text">
            {greeting()}, Admin 👋
          </h2>
          <p className="mt-1 text-sm text-admin-muted">
            Here&apos;s what&apos;s happening with your QalNet platform today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-admin-card border border-admin-border text-sm font-semibold text-admin-text-secondary">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand-600" {...stroke}>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M8 3v4m8-4v4M3 10h18" />
            </svg>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </div>

          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" {...stroke}>
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
              </svg>
              Export Report
              <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 transition-transform ${exportOpen ? 'rotate-180' : ''}`} {...stroke}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {exportOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-44 rounded-lg bg-admin-card border border-admin-border shadow-xl z-50 overflow-hidden py-1"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    exportCsv();
                    setExportOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-admin-text-secondary hover:bg-admin-elevated"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-success-600" {...stroke}>
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                  </svg>
                  CSV
                </button>
                <span
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-admin-disabled cursor-not-allowed"
                  title="Coming soon"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" {...stroke}>
                    <path d="M6 3h12v4H6V3Zm0 6h12M6 13h12m0 8V17H6v4M6 13v4h12v-4" />
                  </svg>
                  PDF
                </span>
                <span
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-admin-disabled cursor-not-allowed"
                  title="Coming soon"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" {...stroke}>
                    <path d="M4 6h16v12H4V6Z" />
                  </svg>
                  Excel
                </span>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    window.print();
                    setExportOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-admin-text-secondary hover:bg-admin-elevated"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-brand-600" {...stroke}>
                    <path d="M7 9V3h10v6M7 18h10v3H7v-3Zm-3-5h16v-2H4v2Z" />
                  </svg>
                  Print
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Five KPI cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <KpiCard
          label="Total Users"
          value={loading && !k ? '—' : (k?.total_users ?? 0)}
          hint={k ? `+${k.new_users_this_month} this month` : 'All registered accounts'}
          accent="success"
          variant="dark"
          icon={kpiIcon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z')}
        />
        <KpiCard
          label="Active Users"
          value={loading && !k ? '—' : (k?.active_users ?? 0)}
          hint={k && k.total_users > 0 ? `${Math.round((k.active_users / k.total_users) * 100)}% of total users` : 'Active accounts'}
          accent="brand"
          variant="dark"
          icon={kpiIcon('M17 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1m8-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 3a3 3 0 1 0 0-6m1 7a4 4 0 0 1 3 4')}
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
          label="Total Transactions (30D)"
          value={loading && !k ? '—' : (k?.transactions_30d ?? 0)}
          hint={k ? `${txGrowth >= 0 ? '+' : ''}${txGrowth}% vs last 30 days` : 'Payments in last 30 days'}
          accent="warning"
          variant="dark"
          icon={kpiIcon('M8 7h12m0 0-4-4m4 4-4 4m4 6H8m0 0 4 4m-4-4 4-4')}
        />
        <KpiCard
          label="Wallet Balance"
          value={loading && !k ? '—' : `ETB ${money(k?.total_wallet_balance ?? 0)}`}
          hint="Across all member wallets"
          accent="success"
          variant="dark"
          icon={kpiIcon('M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z')}
        />
      </div>

      {/* ── Platform Activity ───────────────────────────────────────────── */}
      <section className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 className={cardTitleCls}>Platform Activity</h3>
              <p className={cardSubtitleCls}>Registrations, payments, equbs &amp; joins · {rangeLabel}</p>
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
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-admin-muted hover:text-admin-text'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {range === 'custom' && (
                <div className="grid w-full sm:w-auto grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg border border-admin-border bg-admin-elevated p-1">
                  <input
                    type="date"
                    aria-label="Start date"
                    value={startDate}
                    max={endDate || todayIso()}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full min-w-0 rounded-md border border-admin-border bg-admin-card px-2 py-1 text-xs font-medium text-admin-text focus:outline-none focus:border-brand-500"
                  />
                  <span className="text-xs text-admin-muted">→</span>
                  <input
                    type="date"
                    aria-label="End date"
                    value={endDate}
                    min={startDate || undefined}
                    max={todayIso()}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full min-w-0 rounded-md border border-admin-border bg-admin-card px-2 py-1 text-xs font-medium text-admin-text focus:outline-none focus:border-brand-500"
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
              color="#1E3A8A"
              valueFormatter={(v) => String(v)}
            />
          )}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-admin-border pt-4">
            {[
              { label: 'Today', value: activitySummary.today },
              { label: 'This Week', value: activitySummary.week },
              { label: 'This Month', value: activitySummary.month },
              { label: 'All Time', value: activitySummary.allTime },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-xl font-black text-admin-text">{m.value}</p>
                <p className="text-xs font-semibold text-admin-muted mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
      </section>

      {/* ── Recent pending approvals ─────────────────────────────────────── */}
      <RecentPendingApprovals loading={approvalsLoading} rows={approvals} adminInitials={adminInitials} />

      {/* ── System overview | transactions ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 items-start">
        <SystemOverviewCard
          loading={loading}
          healthy={!!stats}
          apiLatency={apiLatency}
          storage={storagePct}
          lastUpdated={lastUpdated}
        />

        <div className="space-y-6">
          <RecentTransactionsFeed loading={loading} transactions={stats?.recent_transactions ?? []} />
          <TopEqubsCard loading={loading} equbs={stats?.top_equbs ?? []} />
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Recent pending approvals
// ---------------------------------------------------------------------------

function RecentPendingApprovals({
  loading,
  rows,
  adminInitials,
}: {
  loading: boolean;
  rows: PendingApprovalRow[];
  adminInitials: string;
}) {
  const cardCls = 'bg-admin-card rounded-card border border-admin-border';
  const cardTitleCls = 'text-base font-black text-admin-text';
  const cardSubtitleCls = 'text-xs text-admin-muted';

  return (
    <section className={`${cardCls} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border">
        <div>
          <h3 className={cardTitleCls}>Recent Pending Approvals</h3>
          <p className={cardSubtitleCls}>Requests awaiting administrative review</p>
        </div>
        <Link href="/admin/approvals" className="text-xs font-bold text-brand-600 hover:text-brand-700">
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="divide-y divide-admin-border-subtle">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-10 h-10 rounded-full bg-admin-elevated animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-admin-elevated animate-pulse" />
                <div className="h-3 w-64 rounded bg-admin-elevated animate-pulse" />
              </div>
              <div className="h-6 w-16 rounded bg-admin-elevated animate-pulse" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-admin-muted">No pending approvals — all caught up.</p>
      ) : (
        <ul className="divide-y divide-admin-border-subtle">
          {rows.slice(0, 6).map((row, i) => (
            <li key={`${row.type}-${row.name}-${i}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-admin-card-hover transition-colors">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${row.iconClass}`}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
                  <path d={row.icon} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-admin-text">{row.type}</p>
                <p className="text-xs text-admin-muted mt-0.5 truncate">{row.name}</p>
              </div>
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-admin-elevated text-[11px] font-bold text-admin-muted shrink-0">
                {row.category}
              </span>
              <div className="hidden md:block text-right shrink-0">
                <p className="text-xs font-semibold text-admin-text-secondary">{formatShortDate(row.date)}</p>
                <p className="text-[11px] text-admin-muted">{formatTime(row.date)}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[11px] font-black shrink-0">
                {adminInitials}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// System overview
// ---------------------------------------------------------------------------

function SystemOverviewCard({
  loading,
  healthy,
  apiLatency,
  storage,
  lastUpdated,
}: {
  loading: boolean;
  healthy: boolean;
  apiLatency: number | null;
  storage: { pct: number; gb: number };
  lastUpdated: Date | null;
}) {
  const cardCls = 'bg-admin-card rounded-card border border-admin-border';
  const cardTitleCls = 'text-base font-black text-admin-text';
  const cardSubtitleCls = 'text-xs text-admin-muted';

  const latencyLabel = apiLatency == null ? '—' : apiLatency < 200 ? 'Excellent' : apiLatency < 500 ? 'Good' : 'Slow';
  const latencyTone =
    apiLatency == null || apiLatency < 200 ? 'text-success-600' : apiLatency < 500 ? 'text-warning-600' : 'text-danger-600';

  const metrics = [
    {
      label: 'System Uptime',
      value: healthy ? 'Operational' : 'Checking',
      sub: healthy ? 'All services running' : 'Awaiting response',
      icon: 'M12 3v3m6.4 2.6-2.1 2.1M21 12h-3m-6 6v3m-6.4-2.6 2.1-2.1M3 12h3',
      iconClass: 'bg-success-100 text-success-600',
      valueTone: healthy ? 'text-success-600' : 'text-admin-muted',
    },
    {
      label: 'API Response',
      value: apiLatency == null ? '—' : `${apiLatency}ms`,
      sub: latencyLabel,
      icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
      iconClass: 'bg-warning-100 text-warning-600',
      valueTone: latencyTone,
    },
    {
      label: 'Database',
      value: healthy ? 'Healthy' : 'Checking',
      sub: healthy ? 'All systems normal' : 'Awaiting response',
      icon: 'M12 8c-4 0-7 1.3-7 3s3 3 7 3 7-1.3 7-3-3-3-7-3Zm-7 3v5c0 1.7 3 3 7 3s7-1.3 7-3v-5',
      iconClass: 'bg-brand-100 text-brand-600',
      valueTone: healthy ? 'text-success-600' : 'text-admin-muted',
    },
    {
      label: 'Storage Used',
      value: `${storage.pct.toFixed(1)}%`,
      sub: `${storage.gb < 1 ? storage.gb.toFixed(2) : storage.gb.toFixed(0)}GB / 1TB`,
      icon: 'M4 7c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3Zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7',
      iconClass: 'bg-accent-100 text-accent-600',
      valueTone: 'text-admin-text',
    },
  ];

  return (
    <section className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={cardTitleCls}>System Overview</h3>
          <p className={cardSubtitleCls}>Key system metrics at a glance</p>
        </div>
        {lastUpdated && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-admin-muted">
            <svg viewBox="0 0 24 24" className="w-3 h-3" {...stroke}>
              <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />
            </svg>
            Updated {timeAgo(lastUpdated)}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-admin-elevated animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-admin-border p-4">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${m.iconClass}`}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" {...stroke}>
                    <path d={m.icon} />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-admin-muted">{m.label}</p>
              </div>
              <p className={`mt-3 text-xl font-black ${m.valueTone}`}>{m.value}</p>
              <p className="text-[11px] font-semibold text-admin-muted mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Recent transactions feed
// ---------------------------------------------------------------------------

function RecentTransactionsFeed({
  loading,
  transactions,
}: {
  loading: boolean;
  transactions: AdminRecentTransaction[];
}) {
  const cardCls = 'bg-admin-card rounded-card border border-admin-border';
  const cardTitleCls = 'text-base font-black text-admin-text';
  const cardSubtitleCls = 'text-xs text-admin-muted';

  return (
    <section className={`${cardCls} overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-admin-border">
        <div>
          <h3 className={cardTitleCls}>Recent Transactions</h3>
          <p className={cardSubtitleCls}>Latest payments across all equbs</p>
        </div>
        <Link href="/admin/finance" className="text-xs font-bold text-brand-600 hover:text-brand-700">
          View all →
        </Link>
      </div>

      {loading && !transactions.length ? (
        <div className="divide-y divide-admin-border-subtle">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="w-10 h-10 rounded-full bg-admin-elevated animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-admin-elevated animate-pulse" />
                <div className="h-3 w-56 rounded bg-admin-elevated animate-pulse" />
              </div>
              <div className="h-4 w-16 rounded bg-admin-elevated animate-pulse" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-admin-muted">No transactions yet.</p>
      ) : (
        <ul className="divide-y divide-admin-border-subtle">
          {transactions.slice(0, 6).map((t) => (
            <li key={t.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-admin-card-hover transition-colors">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
                  <path d="M3 10h18m0 0-4-4m4 4-4 4" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-admin-text">Payment Received</p>
                <p className="text-xs text-admin-muted mt-0.5 truncate">
                  From: {t.user_first_name} {t.user_last_name} · {t.equb_name} · round {t.round_number}
                </p>
                <p className="text-[11px] text-admin-muted mt-0.5">
                  {formatShortDate(t.created_at)} · {formatTime(t.created_at)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-success-600">+ETB {money(t.amount)}</p>
                <StatusBadge tone={STATUS_TONE[t.status] ?? 'neutral'} variant="dark">
                  {statusLabel(t.status)}
                </StatusBadge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Top equbs
// ---------------------------------------------------------------------------

function TopEqubsCard({ loading, equbs }: { loading: boolean; equbs: AdminTopEqub[] }) {
  const cardCls = 'bg-admin-card rounded-card border border-admin-border';
  const cardTitleCls = 'text-base font-black text-admin-text';
  const cardSubtitleCls = 'text-xs text-admin-muted';

  return (
    <section className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className={cardTitleCls}>Top Equbs</h3>
          <p className={cardSubtitleCls}>Largest circles by membership</p>
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
                  <StatusBadge tone={EQUB_TONE[e.status] ?? 'neutral'} variant="dark">
                    {statusLabel(e.status)}
                  </StatusBadge>
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
