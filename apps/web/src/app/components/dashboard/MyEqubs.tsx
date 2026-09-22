import Link from 'next/link';
import type { EqubGroup } from '@qalnet/shared-types';
import EqubCard from './EqubCard';

interface MyEqubsProps {
  equbs: EqubGroup[];
  loading?: boolean;
  error?: string | null;
}

export default function MyEqubs({ equbs, loading, error }: MyEqubsProps) {
  return (
    <section className="bg-card rounded-card border border-gray-200">
      <div className="flex items-center justify-between px-4 pt-2 pb-1.5">
        <h2 className="text-sm font-black text-[#0066ff]">My Equbs</h2>
        <Link
          href="/my-equbs"
          className="text-[11px] font-bold text-brand-600 hover:text-brand-700"
        >
          View all
        </Link>
      </div>

      <div className="px-4 pb-3">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-card border border-gray-200 p-4 space-y-3">
                <div className="h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
                <div className="h-2 w-full rounded bg-gray-100 animate-pulse" />
                <div className="h-6 w-1/3 rounded bg-gray-100 animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-danger-600">{error}</p>
        ) : equbs.length === 0 ? (
          <div className="rounded-card border border-dashed border-gray-300 px-6 py-6 text-center">
            <p className="text-sm font-bold text-[#0066ff]">No Equbs yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Use &quot;Join an Equb&quot; above to start saving together.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equbs.slice(0, 4).map((equb) => (
              <EqubCard key={equb.id} equb={equb} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
