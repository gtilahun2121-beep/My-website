'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adminAPI,
  APIError,
  AdminFinancePayoutListResponse,
  AdminFinanceTransactionListResponse,
} from '@/app/services/api';
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

type Tab = 'payments' | 'payouts';

export default function AdminTransactionsPage() {
  const { authorized } = useRequireAdmin();
  const [tab, setTab] = useState<Tab>('payments');

  // Payments
  const [payData, setPayData] = useState<AdminFinanceTransactionListResponse | null>(null);
  const [payLoading, setPayLoading] = useState(true);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySearch, setPaySearch] = useState('');
  const [payStatus, setPayStatus] = useState('');
  const [payStart, setPayStart] = useState('');
  const [payEnd, setPayEnd] = useState('');
  const [payPage, setPayPage] = useState(1);
  const payLimit = 10;

  // Payouts
  const [poData, setPoData] = useState<AdminFinancePayoutListResponse | null>(null);
  const [poLoading, setPoLoading] = useState(true);
  const [poError, setPoError] = useState<string | null>(null);
  const [poStatus, setPoStatus] = useState('');
  const [poPage, setPoPage] = useState(1);
  const poLimit = 10;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPayments = useCallback(
    async (p: number, status: string, search: string, start: string, end: string) => {
      setPayLoading(true);
      setPayError(null);
      try {
        const res = await adminAPI.listFinanceTransactions({
          page: p,
          limit: payLimit,
          status: status || undefined,
          search: search.trim() || undefined,
          start: start || undefined,
          end: end || undefined,
        });
        setPayData(res);
      } catch (err) {
        const message =
          err instanceof APIError ? err.data?.message || err.message : 'Failed to load transactions.';
        setPayError(message);
      } finally {
        setPayLoading(false);
      }
    },
    [payLimit],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadPayments(1, payStatus, paySearch, payStart, payEnd);
    }, paySearch ? 400 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [payStatus, paySearch, payStart, payEnd, loadPayments]);

  const loadPayouts = useCallback(
    async (p: number, status: string) => {
      setPoLoading(true);
      setPoError(null);
      try {
        const res = await adminAPI.listFinancePayouts({ page: p, limit: poLimit, status: status || undefined });
        setPoData(res);
      } catch (err) {
        const message =
          err instanceof APIError ? err.data?.message || err.message : 'Failed to load payouts.';
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

  if (!authorized) return <AdminRouteLoading />;

  const payTotalPages = payData ? Math.max(1, Math.ceil(payData.total / payData.limit)) : 1;
  const poTotalPages = poData ? Math.max(1, Math.ceil(poData.total / poData.limit)) : 1;

  const selectCls =
    'py-2.5 px-3 rounded-lg bg-admin-card border border-admin-border text-sm font-semibold text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-500/40';

  return (
    <>
      <div className="inline-flex items-center rounded-lg border border-admin-border bg-admin-elevated p-0.5 w-fit">
        <button
          type="button"
          onClick={() => setTab('payments')}
          className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${
            tab === 'payments' ? 'bg-brand-600 text-[#00d9ff] shadow' : 'text-admin-muted hover:text-admin-text'
          }`}
        >
          Payments{payData ? ` (${payData.total})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setTab('payouts')}
          className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${
            tab === 'payouts' ? 'bg-brand-600 text-[#00d9ff] shadow' : 'text-admin-muted hover:text-admin-text'
          }`}
        >
          Payouts{poData ? ` (${poData.total})` : ''}
        </button>
      </div>

      {tab === 'payments' && (
        <>
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
                value={paySearch}
                onChange={(e) => {
                  setPaySearch(e.target.value);
                  setPayPage(1);
                }}
                placeholder="Search member, phone or equb…"
                aria-label="Search payments"
                className="w-full py-2.5 pl-9 pr-3 rounded-lg bg-admin-card border border-admin-border text-sm text-admin-text placeholder:text-admin-disabled focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={payStatus}
                onChange={(e) => {
                  setPayStatus(e.target.value);
                  setPayPage(1);
                }}
                className={selectCls}
                aria-label="Filter payments by status"
              >
                {PAYMENT_FILTERS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="grid w-full sm:w-auto grid-cols-[1fr_auto_1fr] items-center gap-1.5 rounded-lg border border-admin-border bg-admin-elevated p-1">
                <input
                  type="date"
                  aria-label="Start date"
                  value={payStart}
                  max={payEnd || undefined}
                  onChange={(e) => {
                    setPayStart(e.target.value);
                    setPayPage(1);
                  }}
                  className="w-full min-w-0 rounded-md border border-admin-border bg-admin-card px-2 py-1 text-xs font-medium text-admin-text focus:outline-none focus:border-brand-500"
                />
                <span className="text-xs text-admin-muted">→</span>
                <input
                  type="date"
                  aria-label="End date"
                  value={payEnd}
                  min={payStart || undefined}
                  onChange={(e) => {
                    setPayEnd(e.target.value);
                    setPayPage(1);
                  }}
                  className="w-full min-w-0 rounded-md border border-admin-border bg-admin-card px-2 py-1 text-xs font-medium text-admin-text focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>

          {payLoading && !payData ? (
            <SkeletonTable rows={8} columns={6} variant="dark" />
          ) : payError ? (
            <ErrorState
              title="Could not load payments"
              description={payError}
              onRetry={() => void loadPayments(payPage, payStatus, paySearch, payStart, payEnd)}
              variant="dark"
            />
          ) : !payData || payData.items.length === 0 ? (
            <EmptyState
              title={paySearch || payStatus || payStart ? 'No matching payments' : 'No payments yet'}
              description={
                paySearch || payStatus || payStart
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
                      {payData.items.map((t) => {
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

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-admin-muted">
                  Showing{' '}
                  <span className="font-bold text-admin-text">
                    {payData.total === 0 ? 0 : (payData.page - 1) * payData.limit + 1}–
                    {Math.min(payData.page * payData.limit, payData.total)}
                  </span>{' '}
                  of <span className="font-bold text-admin-text">{payData.total}</span> payments
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.max(1, payPage - 1);
                      setPayPage(p);
                      void loadPayments(p, payStatus, paySearch, payStart, payEnd);
                    }}
                    disabled={payPage <= 1 || payLoading}
                    className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-2 text-sm font-bold text-admin-text">
                    Page {payData.page} of {payTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = Math.min(payTotalPages, payPage + 1);
                      setPayPage(p);
                      void loadPayments(p, payStatus, paySearch, payStart, payEnd);
                    }}
                    disabled={payPage >= payTotalPages || payLoading}
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

      {tab === 'payouts' && (
        <>
          <select
            value={poStatus}
            onChange={(e) => {
              setPoStatus(e.target.value);
              setPoPage(1);
            }}
            className={selectCls}
            aria-label="Filter payouts by status"
          >
            {PAYOUT_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

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
              description={poStatus ? 'Try selecting a different status.' : 'Disbursed rotation payouts will appear here.'}
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
