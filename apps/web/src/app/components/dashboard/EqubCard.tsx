import Link from 'next/link';
import type { EqubGroup } from '@qalnet/shared-types';
import { StatusBadge, type BadgeTone } from '../admin/StatusBadge';
import { formatETB } from './format';

const EQUB_TONE: Record<EqubGroup['status'], BadgeTone> = {
  open: 'info',
  active: 'success',
  completed: 'neutral',
  cancelled: 'danger',
};

const STATUS_LABEL: Record<EqubGroup['status'], string> = {
  open: 'Open',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface EqubCardProps {
  equb: EqubGroup;
}

export default function EqubCard({ equb }: EqubCardProps) {
  const progress = equb.total_rounds > 0 ? Math.round((equb.current_round / equb.total_rounds) * 100) : 0;
  const hostName = `${equb.host_first_name} ${equb.host_last_name}`.trim() || 'Host';

  return (
    <div className="bg-card rounded-card border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-[#0066ff] truncate">{equb.name}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Hosted by {hostName} · {equb.member_count}/{equb.total_rounds} members
          </p>
        </div>
        <StatusBadge tone={EQUB_TONE[equb.status]}>{STATUS_LABEL[equb.status]}</StatusBadge>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-gray-500">Round {equb.current_round} of {equb.total_rounds}</span>
          <span className="text-gray-400">{progress}%</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400">Contribution</p>
          <p className="text-lg font-black text-[#0066ff]">{formatETB(equb.contribution_amount)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-gray-400">Payout pool</p>
          <p className="text-base font-bold text-[#0066ff]">{formatETB(equb.total_amount)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/equbs/${equb.id}`}
          className="flex-1 text-center px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold text-[#0066ff] hover:bg-gray-50 transition-colors"
        >
          View Equb
        </Link>
        <Link
          href="/wallet"
          className="flex-1 text-center px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors"
        >
          Make Payment
        </Link>
      </div>
    </div>
  );
}
