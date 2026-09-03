'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminAPI, APIError, AdminWalletListResponse } from '@/app/services/api';
import { SkeletonTable, EmptyState, ErrorState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';
import { exportCsv as downloadCsv, exportExcel as downloadExcel, exportPdf as downloadPdf } from '@/app/components/admin/exportUtils';

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

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export default function AdminWalletsPage() {
  const [data, setData] = useState<AdminWalletListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 15;

  const load = useCallback(async (nextPage = 1, q = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAPI.listWallets({ page: nextPage, limit, search: q || undefined });
      setData(res);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof APIError ? err.data?.message || err.message : 'Failed to load wallets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(1, search), 250);
    return () => clearTimeout(t);
  }, [search, load]);

  const totalPages = useMemo(() => (data ? Math.max(1, Math.ceil(data.total / limit)) : 1), [data]);

  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  const exportRows = () => {
    if (!data?.items?.length) return null;
    return [
      ['Member', 'Phone', 'Email', 'Balance (ETB)', 'Currency', 'Updated'],
      ...data.items.map((w) => [
        `${w.user_first_name} ${w.user_last_name}`,
        w.user_phone,
        w.user_email || '—',
        w.balance,
        w.currency,
        formatDateTime(w.updated_at),
      ]),
    ];
  };

  const exportCsv = () => {
    const rows = exportRows();
    if (rows) downloadCsv(rows, `qalnet-wallets-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportExcel = () => {
    const rows = exportRows();
    if (rows) downloadExcel(rows, `qalnet-wallets-${new Date().toISOString().slice(0, 10)}.xls`, 'QalNet Wallets');
  };

  const exportPdf = () => {
    const rows = exportRows();
    if (rows) downloadPdf(rows, `qalnet-wallets-${new Date().toISOString().slice(0, 10)}.pdf`, 'QalNet Wallets');
  };

  const cardCls = 'bg-admin-card rounded-card border border-admin-border';
  const inputCls =
    'w-full py-2.5 pl-9 pr-3 rounded-lg bg-admin-card border border-admin-border text-sm text-admin-text placeholder:text-admin-disabled focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-admin-text">Member Wallets</h2>
          <p className="mt-1 text-sm text-admin-muted">
            Live wallet balances across all members.
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
            placeholder="Search by name, phone or email…"
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={exportCsv}
          disabled={!data?.items?.length}
          className="px-3 py-1.5 rounded-lg border border-admin-border text-xs font-bold text-admin-text hover:bg-admin-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          CSV
        </button>
        <button
          type="button"
          onClick={exportExcel}
          disabled={!data?.items?.length}
          className="px-3 py-1.5 rounded-lg border border-admin-border text-xs font-bold text-admin-text hover:bg-admin-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Excel
        </button>
        <button
          type="button"
          onClick={exportPdf}
          disabled={!data?.items?.length}
          className="px-3 py-1.5 rounded-lg border border-admin-border text-xs font-bold text-admin-text hover:bg-admin-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          PDF
        </button>
      </div>

      {error ? (
        <ErrorState title="Could not load wallets" description={error} onRetry={() => void load(page, search)} variant="dark" />
      ) : loading && !data ? (
        <SkeletonTable rows={8} columns={6} variant="dark" />
      ) : !data?.items?.length ? (
        <EmptyState
          title="No wallets found"
          description="No member wallets match your search. Adjust the query or check back later."
          variant="dark"
        />
      ) : (
        <>
          <div className={`${cardCls} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold uppercase tracking-wide text-admin-muted border-b border-admin-border">
                    <th className="px-5 py-3">Member</th>
                    <th className="px-5 py-3">Phone</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3 text-right">Balance</th>
                    <th className="px-5 py-3">Currency</th>
                    <th className="px-5 py-3">Last updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border-subtle">
                  {data.items.map((w) => (
                    <tr key={w.id} className="hover:bg-admin-elevated transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-500/15 text-brand-600 flex items-center justify-center text-xs font-black shrink-0">
                            {initials(w.user_first_name, w.user_last_name)}
                          </div>
                          <span className="font-bold text-admin-text">
                            {`${w.user_first_name} ${w.user_last_name}`.trim() || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-admin-text-secondary">{w.user_phone}</td>
                      <td className="px-5 py-3 text-admin-text-secondary">{w.user_email || '—'}</td>
                      <td className="px-5 py-3 text-right font-black text-success-600">
                        ETB {money(w.balance)}
                      </td>
                      <td className="px-5 py-3 text-admin-text-secondary">{w.currency}</td>
                      <td className="px-5 py-3 text-admin-text-secondary">{formatDateTime(w.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-admin-muted">
              Showing {data.items.length} of {data.total} wallets
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => void load(page - 1, search)}
                className="px-3 py-1.5 rounded-lg border border-admin-border text-xs font-bold text-admin-text hover:bg-admin-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <span className="text-xs font-bold text-admin-muted">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => void load(page + 1, search)}
                className="px-3 py-1.5 rounded-lg border border-admin-border text-xs font-bold text-admin-text hover:bg-admin-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
