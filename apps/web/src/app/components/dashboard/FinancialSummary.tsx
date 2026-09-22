import KpiCard from '../admin/KpiCard';
import { formatETB } from './format';

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

interface FinancialSummaryProps {
  totalSaved: number | null;
  activeEqubs: number | null;
  nextPayment: { amount: number | null; label: string } | null;
  loading?: boolean;
}

export default function FinancialSummary({
  totalSaved,
  activeEqubs,
  nextPayment,
  loading,
}: FinancialSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <KpiCard
        label="Total Saved"
        value={loading && totalSaved === null ? '—' : formatETB(totalSaved ?? 0)}
        hint="Lifetime Equb contributions"
        accent="success"
        icon={kpiIcon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm1-14v2a3 3 0 1 0 0 6h1.5a1.5 1.5 0 0 0 0-3H11m0 0v-1m0 6v-1')}
      />
      <KpiCard
        label="Active Equbs"
        value={loading && activeEqubs === null ? '—' : (activeEqubs ?? 0)}
        hint="Groups you're saving with"
        accent="accent"
        icon={kpiIcon('M17 21v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4M7 4h10a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2Zm2 6h6m-6 4h6')}
      />
      <KpiCard
        label="Next Payment"
        value={loading && !nextPayment ? '—' : formatETB(nextPayment?.amount ?? 0)}
        hint={nextPayment?.label ?? 'No payment scheduled'}
        accent="warning"
        icon={kpiIcon('M8 7V3m8 4V3M3 9h18m-2 4.5V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4.5')}
      />
    </div>
  );
}
