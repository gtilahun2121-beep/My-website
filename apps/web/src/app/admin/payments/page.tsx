'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  adminAPI,
  APIError,
  AdminFinanceOverview,
  AdminFinanceTransactionListResponse,
} from '@/app/services/api';
import KpiCard from '@/app/components/admin/KpiCard';
import { StatusBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { SkeletonTable, EmptyState, ErrorState } from '@/app/components/admin/States';
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

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function statusLabel(status: string) {
  return status.replace('_', ' ').toUpperCase();
}

const TONE: Record<string, BadgeTone> = {
  paid: 'success',
  auto_debited: 'success',
  pending: 'warning',
  failed: 'danger',
};

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'auto_debited', label: 'Auto-debited' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

export default function AdminPaymentsPage() {
  const { authorized } = useRequireAdmin();
  const [overview, setOverview] = useState<AdminFinanceOverview | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [ovError, setOvError] = useState<string | null>(null);

  const [data, setData] = useState<AdminFinanceTransactionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const loadOverview = useCallback(async () => {
    setOvLoading(true);
    setOvError(null);
    try {
      const res = await adminAPI.getFinanceOverview();
      setOverview(res);
    } catch (err) {
      setOvError(err instanceof APIError ? err.data?.message || err.message : 'Failed to load payments overview.');
    } finally {
      setOvLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadOverview(), 0);
    return () => clearTimeout(t);
  }, [loadOverview]);

  const load = useCallback(
    async (p: number, s: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminAPI.listFinanceTransactions({ page: p, limit, status: s || undefined });
        setData(res);
      } catch (err) {
        setError(err instanceof APIError ? err.data?.message || err.message : 'Failed to load payments.');
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(1, status), 0);
    return () => clearTimeout(t);
  }, [status, load]);

  if (!authorized) return <AdminRouteLoading />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const o = overview;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Successful Payments"
          value={ovLoading && !o ? '—' : `${o?.successful_payments ?? 0}`}
          hint={o ? `ETB ${money(o.transaction_volume)} collected` : 'Completed payment attempts'}
          accent="success"
          variant="dark"
          icon={kpiIcon('M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z')}
        />
        <KpiCard
          label="Pending Payments"
          value={ovLoading && !o ? '—' : `${o?.pending_payments ?? 0}`}
          hint={o ? `ETB ${money(o.pending_volume)} awaiting collection` : 'Payments in progress'}
          accent="warning"
          variant="dark"
          icon={kpiIcon('M12 8v4l2.5 2.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z')}
        />
        <KpiCard
          label="Failed Payments"
          value={ovLoading && !o ? '—' : `${o?.failed_payments ?? 0}`}
          hint="Payment attempts that did not complete"
          accent="danger"
          variant="dark"
          icon={kpiIcon('M6 6l12 12M18 6 6 18')}
        />
        <KpiCard
          label="Fees Collected"
          value={ovLoading && !o ? '—' : `ETB ${money(o?.fees_collected ?? 0)}`}
          hint={o ? `Incl. ETB ${money(o.admin_fees_collected)} platform fees` : 'Admin + host fees on payments'}
          accent="accent"
          variant="dark"
          icon={kpiIcon('M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6')}
        />
      </div>

      {ovError && !ovLoading && (
        <ErrorState
          title="Could not load payments overview"
          description={ovError}
          onRetry={() => void loadOverview()}
          variant="dark"
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-black text-admin-text">Payment Activity</h2>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="py-2.5 px-3 rounded-lg bg-admin-card border border-admin-border text-sm font-semibold text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          aria-label="Filter payments by status"
        >
          {FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <SkeletonTable rows={8} columns={5} variant="dark" />
      ) : error ? (
        <ErrorState
          title="Could not load payments"
          description={error}
          onRetry={() => void load(page, status)}
          variant="dark"
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={status ? 'No matching payments' : 'No payments yet'}
          description={status ? 'Try selecting a different status.' : 'Payments made across equbs will appear here.'}
          variant="dark"
        />
      ) : (
        <>
          <div className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border-subtle">
                  {data.items.map((t) => (
                    <tr key={t.id} className="hover:bg-admin-card-hover transition-colors">
                      <td className="px-5 py-3.5 font-bold text-admin-text">
                        {t.user_first_name} {t.user_last_name}
                      </td>
                      <td className="px-5 py-3.5 text-admin-text-secondary max-w-[180px] truncate">
                        {t.equb_name}
                      </td>
                      <td className="px-5 py-3.5 text-admin-text-secondary">Round {t.round_number}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-admin-text whitespace-nowrap">
                        ETB {money(t.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge tone={TONE[t.status] ?? 'neutral'} variant="dark">
                          {statusLabel(t.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-admin-muted whitespace-nowrap">
                        {formatDate(t.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-admin-muted">
              Showing{' '}
              <span className="font-bold text-admin-text">
                {data.total === 0 ? 0 : (data.page - 1) * data.limit + 1}–
                {Math.min(data.page * data.limit, data.total)}
              </span>{' '}
              of <span className="font-bold text-admin-text">{data.total}</span> payments
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  void load(p, status);
                }}
                disabled={page <= 1 || loading}
                className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm font-bold text-admin-text">
                Page {data.page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  void load(p, status);
                }}
                disabled={page >= totalPages || loading}
                className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
