'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminAPI, APIError, AdminEqubListResponse } from '@/app/services/api';
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
  return status.replace(/_/g, ' ').toUpperCase();
}

const TONE: Record<string, BadgeTone> = {
  active: 'success',
  completed: 'info',
  pending: 'warning',
  cancelled: 'neutral',
};

export default function AdminEqubsPage() {
  const { authorized } = useRequireAdmin();
  const [data, setData] = useState<AdminEqubListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const limit = 12;

  const load = useCallback(
    async (p: number, q: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminAPI.listAdminEqubs({ page: p, limit, search: q.trim() || undefined });
        setData(res);
      } catch (err) {
        setError(err instanceof APIError ? err.data?.message || err.message : 'Failed to load equbs.');
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(1, search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  const totalPages = useMemo(() => (data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1), [data]);

  if (!authorized) return <AdminRouteLoading />;

  const inputCls =
    'w-full py-2.5 pl-9 pr-3 rounded-lg bg-admin-card border border-admin-border text-sm text-admin-text placeholder:text-admin-disabled focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-admin-text">Equb Registry</h2>
          <p className="mt-1 text-sm text-admin-muted">
            All Equb groups on the platform — including hosts and member counts.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <svg viewBox="0 0 24 24" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-admin-disabled" {...stroke}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or host…"
            className={inputCls}
          />
        </div>
      </div>

      {error ? (
        <ErrorState title="Could not load equbs" description={error} onRetry={() => void load(data?.page ?? 1, search)} variant="dark" />
      ) : loading && !data ? (
        <SkeletonTable rows={8} columns={6} variant="dark" />
      ) : !data?.items?.length ? (
        <EmptyState
          title="No equbs found"
          description="No Equb groups match your search. Adjust the query or check back later."
          variant="dark"
        />
      ) : (
        <>
          <div className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-admin-elevated text-left text-xs uppercase tracking-wider text-admin-muted">
                    <th className="px-5 py-3 font-bold">Equb</th>
                    <th className="px-5 py-3 font-bold">Host</th>
                    <th className="px-5 py-3 font-bold text-right">Contribution</th>
                    <th className="px-5 py-3 font-bold text-right">Members</th>
                    <th className="px-5 py-3 font-bold text-right">Round</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 font-bold text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border-subtle">
                  {data.items.map((e) => (
                    <tr key={e.id} className="hover:bg-admin-card-hover transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-admin-text max-w-[220px] truncate">{e.name}</p>
                        {e.description && (
                          <p className="text-xs text-admin-muted max-w-[220px] truncate mt-0.5">{e.description}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-admin-text-secondary">
                        {e.host_first_name} {e.host_last_name}
                        <p className="text-xs text-admin-muted">{e.host_phone}</p>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-admin-text whitespace-nowrap">
                        ETB {money(e.contribution_amount)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-admin-text">{e.member_count}</td>
                      <td className="px-5 py-3.5 text-right text-admin-text-secondary">
                        {e.current_round} / {e.total_rounds}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge tone={TONE[e.status] ?? 'neutral'} variant="dark">
                          {statusLabel(e.status)}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-admin-muted whitespace-nowrap">
                        {formatDate(e.created_at)}
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
              of <span className="font-bold text-admin-text">{data.total}</span> equbs
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load(Math.max(1, (data?.page ?? 1) - 1), search)}
                disabled={(data?.page ?? 1) <= 1 || loading}
                className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm font-bold text-admin-text">
                Page {data.page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => void load(Math.min(totalPages, (data?.page ?? 1) + 1), search)}
                disabled={(data?.page ?? 1) >= totalPages || loading}
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