'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminAPI, APIError, AdminSystemLogListResponse } from '@/app/services/api';
import { StatusBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { SkeletonTable, EmptyState, ErrorState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

function actionLabel(action: string) {
  return action.toUpperCase();
}

const ACTION_TONE: Record<string, BadgeTone> = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
};

const ACTION_FILTERS = [
  { value: '', label: 'All actions' },
  { value: 'INSERT', label: 'INSERT' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
];

const TABLE_FILTERS = [
  { value: '', label: 'All tables' },
  { value: 'equb_groups', label: 'equb_groups' },
  { value: 'memberships', label: 'memberships' },
  { value: 'wallets', label: 'wallets' },
  { value: 'payments', label: 'payments' },
  { value: 'payouts', label: 'payouts' },
  { value: 'users', label: 'users' },
  { value: 'withdrawals', label: 'withdrawals' },
];

function truncateJson(v: Record<string, unknown> | null) {
  if (!v) return '—';
  const keys = Object.keys(v);
  if (keys.length === 0) return '{ }';
  return `{ ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', …' : ''} }`;
}

export default function AdminSystemLogsPage() {
  const { authorized } = useRequireAdmin();
  const [data, setData] = useState<AdminSystemLogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState('');
  const [table, setTable] = useState('');
  const limit = 15;

  const load = useCallback(
    async (p: number, a: string, t: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminAPI.listSystemLogs({
          page: p,
          limit,
          action: a || undefined,
          table: t || undefined,
        });
        setData(res);
      } catch (err) {
        setError(err instanceof APIError ? err.data?.message || err.message : 'Failed to load system logs.');
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(1, action, table), 0);
    return () => clearTimeout(t);
  }, [action, table, load]);

  const totalPages = useMemo(() => (data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1), [data]);

  if (!authorized) return <AdminRouteLoading />;

  const selectCls =
    'py-2.5 px-3 rounded-lg bg-admin-card border border-admin-border text-sm font-semibold text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-500/40';

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-admin-text">Security & Audit Trail</h2>
          <p className="mt-1 text-sm text-admin-muted">
            Immutable audit log of every write operation on the platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={action} onChange={(e) => setAction(e.target.value)} className={selectCls} aria-label="Filter by action">
            {ACTION_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select value={table} onChange={(e) => setTable(e.target.value)} className={selectCls} aria-label="Filter by table">
            {TABLE_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState title="Could not load system logs" description={error} onRetry={() => void load(data?.page ?? 1, action, table)} variant="dark" />
      ) : loading && !data ? (
        <SkeletonTable rows={8} columns={6} variant="dark" />
      ) : !data?.items?.length ? (
        <EmptyState
          title="No log entries"
          description="No audit log entries match the selected filters."
          variant="dark"
        />
      ) : (
        <>
          <div className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-admin-elevated text-left text-xs uppercase tracking-wider text-admin-muted">
                    <th className="px-5 py-3 font-bold">Action</th>
                    <th className="px-5 py-3 font-bold">Table</th>
                    <th className="px-5 py-3 font-bold">Row ID</th>
                    <th className="px-5 py-3 font-bold">Performed By</th>
                    <th className="px-5 py-3 font-bold">Changed Fields</th>
                    <th className="px-5 py-3 font-bold text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border-subtle">
                  {data.items.map((log) => (
                    <tr key={log.id} className="hover:bg-admin-card-hover transition-colors">
                      <td className="px-5 py-3.5">
                        <StatusBadge tone={ACTION_TONE[log.action.toUpperCase()] ?? 'neutral'} variant="dark">
                          {actionLabel(log.action)}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                          {log.table_name}
                        </code>
                      </td>
                      <td className="px-5 py-3.5">
                        <code className="text-xs font-mono text-admin-text-secondary">{log.row_id}</code>
                      </td>
                      <td className="px-5 py-3.5 text-admin-text-secondary">
                        {log.performed_by_name ?? 'System'}
                      </td>
                      <td className="px-5 py-3.5 text-admin-muted font-mono text-xs">
                        {truncateJson(log.new_values ?? log.old_values)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-admin-muted whitespace-nowrap">
                        {formatDateTime(log.performed_at)}
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
              of <span className="font-bold text-admin-text">{data.total}</span> log entries
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void load(Math.max(1, (data?.page ?? 1) - 1), action, table)}
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
                onClick={() => void load(Math.min(totalPages, (data?.page ?? 1) + 1), action, table)}
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