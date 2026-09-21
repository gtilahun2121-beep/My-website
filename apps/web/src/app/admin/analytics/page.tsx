'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminAPI, APIError, AdminStats } from '@/app/services/api';
import KpiCard from '@/app/components/admin/KpiCard';
import { AreaChart, DonutChart } from '@/app/components/admin/DashboardCharts';
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

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatRangeDate(iso: string) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

export default function AdminAnalyticsPage() {
  const { authorized } = useRequireAdmin();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
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
        err instanceof APIError ? err.data?.message || err.message : 'Failed to load analytics.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const k = stats?.kpis;

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

  const engagement = useMemo(() => {
    const kp = k;
    if (!kp) return [];
    const total = kp.total_users || 1;
    const memberships = kp.total_memberships ?? 0;
    const equity = Math.round((memberships / total) * 100);
    return [
      { label: 'Enrolled in Equbs', value: equity, color: '#1E3A8A' },
      { label: 'Not enrolled', value: Math.max(0, 100 - equity), color: '#E2E8F0' },
    ];
  }, [k]);

  const rangeLabel = useMemo(() => {
    if (range === 'custom') {
      if (startDate && endDate) return `${formatRangeDate(startDate)} – ${formatRangeDate(endDate)}`;
      return 'pick start & end dates';
    }
    return `last ${range === '7d' ? '7 days' : range === '90d' ? '90 days' : '30 days'}`;
  }, [range, startDate, endDate]);

  const growth = useMemo(() => {
    const cur = k?.transactions_30d ?? 0;
    const prev = k?.transactions_prev_30d ?? 0;
    if (prev <= 0) return cur > 0 ? 100 : 0;
    return Math.round(((cur - prev) / prev) * 100);
  }, [k]);

  if (!authorized) return <AdminRouteLoading />;

  const cardCls = 'bg-admin-card rounded-card border border-admin-border';
  const ranges: { key: '7d' | '30d' | '90d' | 'custom'; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
          hint={k && k.total_users > 0 ? `${Math.round((k.active_users / k.total_users) * 100)}% of total` : 'Active accounts'}
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
          label="Transactions (30D)"
          value={loading && !k ? '—' : (k?.transactions_30d ?? 0)}
          hint={k ? `${growth >= 0 ? '+' : ''}${growth}% vs prev 30 days` : 'Payments in last 30 days'}
          accent="warning"
          variant="dark"
          icon={kpiIcon('M8 7h12m0 0-4-4m4 4-4 4m4 6H8m0 0 4 4m-4-4 4-4')}
        />
      </div>

      <section className={`${cardCls} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-black text-admin-text">Platform Activity Trend</h3>
            <p className="text-xs text-admin-muted">Registrations, payments, equbs &amp; joins · {rangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-admin-border bg-admin-elevated p-0.5">
              {ranges.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${
                    range === r.key ? 'bg-brand-600 text-white shadow' : 'text-admin-muted hover:text-admin-text'
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
          <AreaChart data={trend} color="#1E3A8A" valueFormatter={(v) => String(v)} />
        )}
      </section>

      {error && !loading && (
        <div className={`${cardCls} p-5`}>
          <p className="text-sm font-semibold text-danger-500">Could not load analytics.</p>
          <p className="text-sm text-admin-muted mt-1">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 items-start">
        <section className={`${cardCls} p-5`}>
          <h3 className="text-base font-black text-admin-text">Member Engagement</h3>
          <p className="text-xs text-admin-muted mb-4">Share of members enrolled in at least one Equb</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <DonutChart
              segments={engagement}
              centerTitle={`${engagement[0]?.value ?? 0}%`}
              centerSubtitle="enrolled"
            />
            <div className="space-y-3">
              {engagement.map((seg) => (
                <div key={seg.label} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden="true" />
                  <span className="text-sm font-semibold text-admin-text">{seg.label}</span>
                  <span className="text-sm font-bold text-admin-muted">{seg.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${cardCls} p-5`}>
          <h3 className="text-base font-black text-admin-text">Composition</h3>
          <p className="text-xs text-admin-muted mb-4">Activity split across the platform</p>
          <div className="space-y-4">
            {[
              { label: 'Registrations', value: k?.new_users_this_month ?? 0 },
              { label: 'Payments', value: k?.successful_payments ?? 0 },
              { label: 'Memberships', value: k?.total_memberships ?? 0 },
              { label: 'Wallet Balance', value: k ? `ETB ${money(k.total_wallet_balance)}` : '—' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-lg border border-admin-border px-4 py-3">
                <span className="text-sm font-semibold text-admin-text">{row.label}</span>
                <span className="text-sm font-black text-brand-700">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
