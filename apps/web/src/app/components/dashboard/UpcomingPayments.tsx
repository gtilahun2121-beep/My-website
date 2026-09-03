import Link from 'next/link';
import type { EqubGroup } from '@qalnet/shared-types';
import { formatETB } from './format';

interface UpcomingPaymentsProps {
  equbs: EqubGroup[];
  loading?: boolean;
}

export default function UpcomingPayments({ equbs, loading }: UpcomingPaymentsProps) {
  const active = equbs.filter((e) => e.status === 'active' || e.status === 'open');
  const items = active.slice(0, 4);

  return (
    <section className="bg-card rounded-card border border-gray-200">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-lg font-black text-[#00d9ff]">Upcoming Payments</h2>
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500">
            No payments scheduled. When you join an active Equb, upcoming contributions will show here.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((e) => {
              const roundDue = Math.min(e.current_round + 1, e.total_rounds);
              return (
                <div key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#00d9ff] truncate">{e.name}</p>
                    <p className="text-xs text-gray-400">
                      Round {roundDue} of {e.total_rounds}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-[#00d9ff]">{formatETB(e.contribution_amount)}</p>
                    <Link
                      href="/wallet"
                      className="text-xs font-bold text-brand-600 hover:text-brand-700"
                    >
                      Pay now
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
