'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminAPI, APIError, AdminFinanceOverview, AdminStats } from '@/app/services/api';
import KpiCard from '@/app/components/admin/KpiCard';
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

const kpiIcon = (path: string) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
    <path d={path} />
  </svg>
);

function money(n: number | string) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

type ReportKind = 'users' | 'transactions' | 'equbs' | 'finance';

export default function AdminReportsPage() {
  const { authorized } = useRequireAdmin();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [finance, setFinance] = useState<AdminFinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<ReportKind | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, f] = await Promise.all([adminAPI.getStats({ range: '30d' }), adminAPI.getFinanceOverview()]);
      setStats(s);
      setFinance(f);
    } catch (err) {
      const message =
        err instanceof APIError ? err.data?.message || err.message : 'Failed to load report data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const dateStamp = new Date().toISOString().slice(0, 10);
  const k = stats?.kpis;

  const rowsFor = (kind: ReportKind): (string | number)[][] | null => {
    if (kind === 'users') {
      if (!stats) return null;
      return [
        ['Metric', 'Value'],
        ['Total users', k?.total_users ?? 0],
        ['Active users', k?.active_users ?? 0],
        ['Hosts', k?.hosts ?? 0],
        ['New users this month', k?.new_users_this_month ?? 0],
        ['Total memberships', k?.total_memberships ?? 0],
      ];
    }
    if (kind === 'transactions') {
      if (!stats) return null;
      return [
        ['Metric', 'Value'],
        ['Successful payments', k?.successful_payments ?? 0],
        ['Pending payments', k?.pending_payments ?? 0],
        ['Failed transactions', k?.failed_transactions ?? 0],
        ['Transactions (30d)', k?.transactions_30d ?? 0],
        ['Transactions (prev 30d)', k?.transactions_prev_30d ?? 0],
      ];
    }
    if (kind === 'equbs') {
      if (!stats) return null;
      return [
        ['Metric', 'Value'],
        ['Total equbs', k?.total_equbs ?? 0],
        ['Active equbs', k?.active_equbs ?? 0],
        ['Operational equbs', k?.operational_equbs ?? 0],
      ];
    }
    if (kind === 'finance') {
      if (!finance) return null;
      return [
        ['Metric', 'Value (ETB)'],
        ['Total wallet balance', finance.total_wallet_balance],
        ['Transaction volume', finance.transaction_volume],
        ['Pending volume', finance.pending_volume],
        ['Fees collected', finance.fees_collected],
        ['Admin fees collected', finance.admin_fees_collected],
        ['Payout volume', finance.payout_volume],
        ['Pending withdrawal volume', finance.pending_withdrawal_volume],
      ];
    }
    return null;
  };

  const handleExport = async (kind: ReportKind, fmt: 'csv' | 'excel' | 'pdf') => {
    const rows = rowsFor(kind);
    if (!rows) return;
    setDownloading(kind);
    // Defer to let the "Generating…" label paint before the sync download.
    await new Promise((r) => setTimeout(r, 30));
    const base = `qalnet-${kind}-report-${dateStamp}`;
    if (fmt === 'csv') downloadCsv(rows, `${base}.csv`);
    else if (fmt === 'excel') downloadExcel(rows, `${base}.xls`, `QalNet ${kind} report`);
    else downloadPdf(rows, `${base}.pdf`, `QalNet ${kind} report`);
    setDownloading(null);
  };

  const reports = useMemo(
    () => [
      {
        key: 'users' as ReportKind,
        title: 'Member Report',
        desc: 'Registration and membership aggregates',
        icon: 'M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z',
      },
      {
        key: 'transactions' as ReportKind,
        title: 'Transactions Report',
        desc: 'Payments, success and failure aggregates',
        icon: 'M3 17l6-6 4 4 7-7m0 0v5m0-5h-5',
      },
      {
        key: 'equbs' as ReportKind,
        title: 'Equbs Report',
        desc: 'Equb group counts and operational status',
        icon: 'M4 21v-9m5 9v-7m5 7V4m5 17V10',
      },
      {
        key: 'finance' as ReportKind,
        title: 'Finance Report',
        desc: 'Wallet balances, fees and payout volumes',
        icon: 'M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
      },
    ],
    [],
  );

  if (!authorized) return <AdminRouteLoading />;

  const cardCls = 'bg-admin-card rounded-card border border-admin-border';
  const actionCls = (kind: ReportKind) =>
    `px-3 py-1.5 rounded-lg border border-admin-border text-xs font-bold transition-colors ${
      downloading === kind
        ? 'text-brand-600 border-brand-500/50 bg-brand-50'
        : 'text-admin-text hover:bg-admin-elevated'
    } disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Registered Members"
          value={loading && !k ? '—' : (k?.total_users ?? 0)}
          hint={k ? `+${k.new_users_this_month} this month` : 'All registered accounts'}
          accent="success"
          variant="dark"
          icon={kpiIcon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z')}
        />
        <KpiCard
          label="Active Equbs"
          value={loading && !k ? '—' : (k?.active_equbs ?? 0)}
          hint={k ? `${k.operational_equbs} operational` : 'Active equb circles'}
          accent="accent"
          variant="dark"
          icon={kpiIcon('M4 21v-9m5 9v-7m5 7V4m5 17V10')}
        />
        <KpiCard
          label="Transaction Volume"
          value={loading && !finance ? '—' : `ETB ${money(finance?.transaction_volume ?? 0)}`}
          hint={finance ? `${finance.successful_payments} successful payments` : 'Collected from successful payments'}
          accent="success"
          variant="dark"
          icon={kpiIcon('M8 7h12m0 0-4-4m4 4-4 4m4 6H8m0 0 4 4m-4-4 4-4')}
        />
        <KpiCard
          label="Fees Collected"
          value={loading && !finance ? '—' : `ETB ${money(finance?.fees_collected ?? 0)}`}
          hint={finance ? `Incl. ETB ${money(finance.admin_fees_collected)} platform fees` : 'Admin + host fees on payments'}
          accent="warning"
          variant="dark"
          icon={kpiIcon('M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6')}
        />
      </div>

      {error && !loading && (
        <div className={`${cardCls} p-5`}>
          <p className="text-sm font-semibold text-danger-500">Could not load report data.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <div key={r.key} className={`${cardCls} p-5`}>
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
                  <path d={r.icon} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-admin-text">{r.title}</h3>
                <p className="text-xs text-admin-muted mt-0.5">{r.desc}</p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    disabled={loading || downloading !== null}
                    onClick={() => void handleExport(r.key, 'csv')}
                    className={actionCls(r.key)}
                  >
                    {downloading === r.key ? 'Generating…' : 'CSV'}
                  </button>
                  <button
                    type="button"
                    disabled={loading || downloading !== null}
                    onClick={() => void handleExport(r.key, 'excel')}
                    className={actionCls(r.key)}
                  >
                    Excel
                  </button>
                  <button
                    type="button"
                    disabled={loading || downloading !== null}
                    onClick={() => void handleExport(r.key, 'pdf')}
                    className={actionCls(r.key)}
                  >
                    PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`${cardCls} p-5`}>
        <h3 className="text-base font-black text-admin-text">Export History & Notes</h3>
        <ul className="mt-3 space-y-2 text-sm text-admin-muted">
          <li>• Reports reflect data as of {new Date().toLocaleString()} and include only the latest snapshot.</li>
          <li>• CSV and Excel exports are generated in the browser — no data leaves your device.</li>
          <li>• Full exportable lists (users, wallets, transactions, equbs) live under their respective sections.</li>
        </ul>
      </div>
    </>
  );
}