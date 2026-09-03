import type { WalletTransaction } from '@qalnet/shared-types';
import { formatETB, formatDate } from './format';

const DIRECTION_META: Record<
  WalletTransaction['direction'],
  { label: string; icon: React.ReactNode; tone: { iconBg: string; amount: string } }
> = {
  payment: {
    label: 'Equb contribution',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14m-7-7h14" />
      </svg>
    ),
    tone: { iconBg: 'bg-danger-100 text-danger-600', amount: 'text-danger-600' },
  },
  payout: {
    label: 'Payout received',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5m-7 7 7-7 7 7" />
      </svg>
    ),
    tone: { iconBg: 'bg-success-100 text-success-700', amount: 'text-success-700' },
  },
  deposit: {
    label: 'Wallet top-up',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      </svg>
    ),
    tone: { iconBg: 'bg-success-100 text-success-700', amount: 'text-success-700' },
  },
  withdrawal: {
    label: 'Cash withdrawal',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12l7-7 7 7" />
      </svg>
    ),
    tone: { iconBg: 'bg-danger-100 text-danger-600', amount: 'text-danger-600' },
  },
};

interface RecentActivityProps {
  transactions: WalletTransaction[];
  loading?: boolean;
}

export default function RecentActivity({ transactions, loading }: RecentActivityProps) {
  const items = transactions.slice(0, 6);

  return (
    <section className="bg-card rounded-card border border-gray-200">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-lg font-black text-[#00d9ff]">Recent Activity</h2>
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-gray-100 animate-pulse" />
                </div>
                <div className="h-3 w-14 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">No activity yet. Your wallet transactions will appear here.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((txn) => {
              const meta = DIRECTION_META[txn.direction];
              const outgoing = txn.direction === 'payment' || txn.direction === 'withdrawal';
              const time = formatDate(txn.paid_at || txn.created_at);
              return (
                <div key={txn.id} className="flex items-center gap-3 py-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.tone.iconBg}`}>
                    {meta.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#00d9ff] truncate">
                      {meta.label}
                      {txn.equb_name ? ` · ${txn.equb_name}` : ''}
                    </p>
                    <p className="text-xs text-gray-400">{time}</p>
                  </div>
                  <p className={`text-sm font-black whitespace-nowrap ${meta.tone.amount}`}>
                    {outgoing ? '−' : '+'}
                    {formatETB(txn.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
