'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminAPI,
  APIError,
  AdminFinanceOverview,
  AdminFinancePayoutListResponse,
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

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function statusLabel(status: string) {
  return status.replace('_', ' ').toUpperCase();
}

const PAYMENT_TONE: Record<string, BadgeTone> = {
  paid: 'success',
  auto_debited: 'success',
  pending: 'warning',
  failed: 'danger',
};

const PAYOUT_TONE: Record<string, BadgeTone> = {
  pending: 'warning',
  approved: 'info',
  batched: 'info',
  completed: 'success',
  failed: 'danger',
};

const PAYMENT_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'paid', label: 'Paid' },
  { value: 'auto_debited', label: 'Auto-debited' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const PAYOUT_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'batched', label: 'Batched' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

type FinanceTab = 'transactions' | 'payouts';

export default function AdminFinancePage() {
  const [overview, setOverview] = useState<AdminFinanceOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [tab, setTab] = useState<FinanceTab>('transactions');

  // Transactions state
  const [txData, setTxData] = useState<AdminFinanceTransactionListResponse | null>(null);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [txSearch, setTxSearch] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txStart, setTxStart] = useState('');
  const [txEnd, setTxEnd] = useState('');
  const [txPage, setTxPage] = useState(1);
  const txLimit = 10;

  // Payouts state
  const [poData, setPoData] = useState<AdminFinancePayoutListResponse | null>(null);
  const [poLoading, setPoLoading] = useState(true);
  const [poError, setPoError] = useState<string | null>(null);
  const [poStatus, setPoStatus] = useState('');
  const [poPage, setPoPage] = useState(1);
  const poLimit = 10;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await adminAPI.getFinanceOverview();
      setOverview(res);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load finance overview.';
      setOverviewError(message);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadOverview(), 0);
    return () => clearTimeout(t);
  }, [loadOverview]);

  const loadTransactions = useCallback(
    async (p: number, status: string, search: string, start: string, end: string) => {
      setTxLoading(true);
      setTxError(null);
      try {
        const res = await adminAPI.listFinanceTransactions({
          page: p,
          limit: txLimit,
          status: status || undefined,
          search: search.trim() || undefined,
          start: start || undefined,
          end: end || undefined,
        });
        setTxData(res);
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.data?.message || err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load transactions.';
        setTxError(message);
      } finally {
        setTxLoading(false);
      }
    },
    [txLimit],
  );

  // Debounced search + filters → refetch from page 1
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadTransactions(1, txStatus, txSearch, txStart, txEnd);
    }, txSearch ? 400 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [txStatus, txSearch, txStart, txEnd, loadTransactions]);

  const loadPayouts = useCallback(
    async (p: number, status: string) => {
      setPoLoading(true);
      setPoError(null);
      try {
        const res = await adminAPI.listFinancePayouts({ page: p, limit: poLimit, status: status || undefined });
        setPoData(res);
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.data?.message || err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load payouts.';
        setPoError(message);
      } finally {
        setPoLoading(false);
      }
    },
    [poLimit],
  );

  useEffect(() => {
    const t = setTimeout(() => void loadPayouts(1, poStatus), 0);
    return () => clearTimeout(t);
  }, [poStatus, loadPayouts]);

  const txTotalPages = txData ? Math.max(1, Math.ceil(txData.total / txData.limit)) : 1;
  const poTotalPages = poData ? Math.max(1, Math.ceil(poData.total / poData.limit)) : 1;

  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  const o = overview;
  const totalInOut =
    (o?.transaction_volume ?? 0) +
    (o?.pending_volume ?? 0) +
    (o?.payout_volume ?? 0) +
    (o?.pending_withdrawal_volume ?? 0);

  return (
    <>
      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Wallet Balance"
          value={overviewLoading && !o ? '—' : `ETB ${money(o?.total_wallet_balance ?? 0)}`}
          hint={o ? `Across ${o.wallet_count} member wallets` : 'All member wallet balances'}
          accent="brand"
          variant="dark"
          icon={kpiIcon('M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z')}
        />
        <KpiCard
          label="Transaction Volume"
          value={overviewLoading && !o ? '—' : `ETB ${money(o?.transaction_volume ?? 0)}`}
          hint={o ? `${o.successful_payments} successful payments` : 'Collected from successful payments'}
          accent="success"
          variant="dark"
          icon={kpiIcon('M8 7h12m0 0-4-4m4 4-4 4m4 6H8m0 0 4 4m-4-4 4-4')}
        />
        <KpiCard
          label="Pending Withdrawals"
          value={overviewLoading && !o ? '—' : (o?.pending_withdrawals ?? 0)}
          hint={
            o
              ? `ETB ${money(o.pending_withdrawal_volume)} awaiting disbursement`
              : 'Payouts awaiting disbursement'
          }
          accent="warning"
          variant="dark"
          icon={kpiIcon('M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2')}
        />
        <KpiCard
          label="Fees Collected"
          value={overviewLoading && !o ? '—' : `ETB ${money(o?.fees_collected ?? 0)}`}
          hint={o ? `Incl. ETB ${money(o.admin_fees_collected)} platform fees` : 'Admin + host fees on successful payments'}
          accent="accent"
          variant="dark"
          icon={kpiIcon('M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6')}
        />
      </div>

      {overviewError && !overviewLoading && (
        <ErrorState
          title="Could not load finance overview"
          description={overviewError}
          onRetry={() => void loadOverview()}
          variant="dark"
        />
      )}

      {/* ── Tab switcher ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-lg border border-admin-border bg-admin-elevated p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setTab('transactions')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${
              tab === 'transactions'
                ? 'bg-brand-600 text-white shadow'
                : 'text-admin-muted hover:text-admin-text'
            }`}
          >
            Transactions
            {txData ? ` (${txData.total})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setTab('payouts')}
            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${
              tab === 'payouts'
                ? 'bg-brand-600 text-white shadow'
                : 'text-admin-muted hover:text-admin-text'
            }`}
          >
            Payouts
            {poData ? ` (${poData.total})` : ''}
          </button>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-admin-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success-500" aria-hidden="true" />
            ETB {money(totalInOut)} total financial flow
          </span>
        </div>
      </div>

      {/* ── Transactions tab ─────────────────────────────────────────────── */}
      {tab === 'transactions' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-admin-disabled"
                {...stroke}
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" />
              </svg>
              <input
                type="search"
                value={txSearch}
                onChange={(e) => {
                  setTxSearch(e.target.value);
                  setTxPage(1);
                }}
                placeholder="Search member, phone or equb…"
                aria-label="Search transactions"
                className="w-full py-2.5 pl-9 pr-3 rounded-lg bg-admin-card border border-admin-border text-sm text-admin-text placeholder:text-admin-disabled focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={txStatus}
                onChange={(e) => {
                  setTxStatus(e.target.value);
                  setTxPage(1);
                }}
                className="py-2.5 px-3 rounded-lg bg-admin-card border border-admin-border text-sm font-semibold text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                aria-label="Filter transactions by status"
              >
                {PAYMENT_FILTERS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-admin-border bg-admin-elevated p-1">
                <input
                  type="date"
                  aria-label="Start date"
                  value={txStart}
                  max={txEnd || undefined}
                  onChange={(e) => {
                    setTxStart(e.target.value);
                    setTxPage(1);
                  }}
                  className="rounded-md border border-admin-border bg-admin-card px-2 py-1 text-xs font-medium text-admin-text focus:outline-none focus:border-brand-500"
                />
                <span className="text-xs text-admin-muted">→</span>
                <input
                  type="date"
                  aria-label="End date"
                  value={txEnd}
                  min={txStart || undefined}
                  onChange={(e) => {
                    setTxEnd(e.target.value);
                    setTxPage(1);
                  }}
                  className="rounded-md border border-admin-border bg-admin-card px-2 py-1 text-xs font-medium text-admin-text focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {txLoading && !txData ? (
            <SkeletonTable rows={8} columns={6} variant="dark" />
          ) : txError ? (
            <ErrorState
              title="Could not load transactions"
              description={txError}
              onRetry={() => void loadTransactions(txPage, txStatus, txSearch, txStart, txEnd)}
              variant="dark"
            />
          ) : !txData || txData.items.length === 0 ? (
            <EmptyState
              title={txSearch || txStatus || txStart ? 'No matching transactions' : 'No transactions yet'}
              description={
                txSearch || txStatus || txStart
                  ? 'Try adjusting the search, status or date filters.'
                  : 'Payments made across equbs will appear here.'
              }
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
                        <th className="px-5 py-3 font-bold text-right">Fee</th>
                        <th className="px-5 py-3 font-bold">Status</th>
                        <th className="px-5 py-3 font-bold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-admin-border-subtle">
                      {txData.items.map((t) => {
                        const fee = Number(t.fee_deducted ?? 0) + Number(t.host_commission_deducted ?? 0);
                        return (
                          <tr key={t.id} className="hover:bg-admin-card-hover transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                                  {initials(t.user_first_name, t.user_last_name)}
                                </div>
                                <div>
                                  <p className="font-bold text-admin-text">
                                    {t.user_first_name} {t.user_last_name}
                                  </p>
                                  <p className="text-xs text-admin-muted">{t.user_phone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-admin-text-secondary max-w-[180px] truncate">
                              {t.equb_name}
                            </td>
                            <td className="px-5 py-3.5 text-admin-text-secondary">Round {t.round_number}</td>
                            <td className="px-5 py-3.5 text-right font-bold text-admin-text whitespace-nowrap">
                              ETB {money(t.amount)}
                            </td>
                            <td className="px-5 py-3.5 text-right text-admin-muted whitespace-nowrap">
                              {fee > 0 ? `ETB ${money(fee)}` : '—'}
                            </td>
                            <td className="px-5 py-3.5">
                              <StatusBadge tone={PAYMENT_TONE[t.status] ?? 'neutral'} variant="dark">
                                {statusLabel(t.status)}
                              </StatusBadge>
                            </td>
                            <td className="px-5 py-3.5 text-right text-admin-muted whitespace-nowrap">
                              <p className="font-semibold text-admin-text-secondary">{formatDate(t.created_at)}</p>
                              <p className="text-[11px]">{formatTime(t.created_at)}</p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-admin-muted">
                  Showing{' '}
                  <span className="font-bold text-admin-text">
                    {txData.total === 0 ? 0 : (txData.page - 1) * txData.limit + 1}–
                    {Math.min(txData.page * txData.limit, txData.total)}
                  </span>{' '}
                  of <span className="font-bold text-admin-text">{txData.total}</span> transactions
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.max(1, txPage - 1);
                      setTxPage(p);
                      void loadTransactions(p, txStatus, txSearch, txStart, txEnd);
                    }}
                    disabled={txPage <= 1 || txLoading}
                    className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm font-bold text-admin-text">
                    Page {txData.page} of {txTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.min(txTotalPages, txPage + 1);
                      setTxPage(p);
                      void loadTransactions(p, txStatus, txSearch, txStart, txEnd);
                    }}
                    disabled={txPage >= txTotalPages || txLoading}
                    className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Payouts tab ─────────────────────────────────────────────────── */}
      {tab === 'payouts' && (
        <>
          <div className="flex items-center gap-3">
            <select
              value={poStatus}
              onChange={(e) => {
                setPoStatus(e.target.value);
                setPoPage(1);
              }}
              className="py-2.5 px-3 rounded-lg bg-admin-card border border-admin-border text-sm font-semibold text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              aria-label="Filter payouts by status"
            >
              {PAYOUT_FILTERS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {poLoading && !poData ? (
            <SkeletonTable rows={8} columns={5} variant="dark" />
          ) : poError ? (
            <ErrorState
              title="Could not load payouts"
              description={poError}
              onRetry={() => void loadPayouts(poPage, poStatus)}
              variant="dark"
            />
          ) : !poData || poData.items.length === 0 ? (
            <EmptyState
              title={poStatus ? 'No matching payouts' : 'No payouts yet'}
              description={
                poStatus
                  ? 'Try selecting a different status.'
                  : 'Disbursed rotation payouts will appear here.'
              }
              variant="dark"
            />
          ) : (
            <>
              <div className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-admin-elevated text-left text-xs uppercase tracking-wider text-admin-muted">
                        <th className="px-5 py-3 font-bold">Winner</th>
                        <th className="px-5 py-3 font-bold">Equb</th>
                        <th className="px-5 py-3 font-bold">Round</th>
                        <th className="px-5 py-3 font-bold text-right">Pot Amount</th>
                        <th className="px-5 py-3 font-bold">Status</th>
                        <th className="px-5 py-3 font-bold text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-admin-border-subtle">
                      {poData.items.map((p) => (
                        <tr key={p.id} className="hover:bg-admin-card-hover transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center text-xs font-bold shrink-0">
                                {initials(p.winner_first_name, p.winner_last_name)}
                              </div>
                              <div>
                                <p className="font-bold text-admin-text">
                                  {p.winner_first_name} {p.winner_last_name}
                                </p>
                                <p className="text-xs text-admin-muted">{p.winner_phone}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-admin-text-secondary max-w-[180px] truncate">
                            {p.equb_name}
                          </td>
                          <td className="px-5 py-3.5 text-admin-text-secondary">Round {p.round_number}</td>
                          <td className="px-5 py-3.5 text-right font-bold text-admin-text whitespace-nowrap">
                            ETB {money(p.total_pot_amount)}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge tone={PAYOUT_TONE[p.status] ?? 'neutral'} variant="dark">
                              {statusLabel(p.status)}
                            </StatusBadge>
                          </td>
                          <td className="px-5 py-3.5 text-right text-admin-muted whitespace-nowrap">
                            <p className="font-semibold text-admin-text-secondary">{formatDate(p.created_at)}</p>
                            <p className="text-[11px]">{formatTime(p.created_at)}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-admin-muted">
                  Showing{' '}
                  <span className="font-bold text-admin-text">
                    {poData.total === 0 ? 0 : (poData.page - 1) * poData.limit + 1}–
                    {Math.min(poData.page * poData.limit, poData.total)}
                  </span>{' '}
                  of <span className="font-bold text-admin-text">{poData.total}</span> payouts
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.max(1, poPage - 1);
                      setPoPage(p);
                      void loadPayouts(p, poStatus);
                    }}
                    disabled={poPage <= 1 || poLoading}
                    className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm font-bold text-admin-text">
                    Page {poData.page} of {poTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.min(poTotalPages, poPage + 1);
                      setPoPage(p);
                      void loadPayouts(p, poStatus);
                    }}
                    disabled={poPage >= poTotalPages || poLoading}
                    className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
