'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EqubGroup, UserLotteryCurrentResponse, UserLotteryHistoryResponse } from '@qalnet/shared-types';
import api from '@/app/services/api';

interface LotterySectionProps {
  equbs: EqubGroup[];
  loading?: boolean;
}

const LIMIT = 5;

export default function LotterySection({ equbs, loading }: LotterySectionProps) {
  const active = useMemo(
    () => equbs.filter((e) => e.status === 'active' || e.status === 'open'),
    [equbs],
  );

  // '' means "auto-select the first active Equb".
  const [equbId, setEqubId] = useState<string>('');
  const [current, setCurrent] = useState<UserLotteryCurrentResponse | null>(null);
  const [history, setHistory] = useState<UserLotteryHistoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const selectedId = equbId || active[0]?.id || '';
  const isLoading = loading || busy;

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    Promise.all([
      api.equbAPI.getLotteryCurrent(selectedId),
      api.equbAPI.getLotteryHistory(selectedId, { page, limit: LIMIT }),
    ])
      .then(([c, h]) => {
        if (cancelled) return;
        setCurrent(c);
        setHistory(h);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setCurrent(null);
        setHistory(null);
        setError(e instanceof Error ? e.message : 'Could not load lottery status.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, page]);

  const selectEqub = (id: string) => {
    setEqubId(id);
    setPage(1);
    setBusy(true);
  };

  const gotoPage = (p: number) => {
    setPage(p);
    setBusy(true);
  };

  const showSkeleton = isLoading && !current && !error;

  return (
    <section className="bg-card rounded-card border border-slate-200">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-slate-900">Lottery</h2>

        {active.length > 1 && (
          <select
            aria-label="Select Equb"
            value={selectedId}
            onChange={(e) => selectEqub(e.target.value)}
            className="text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {active.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {showSkeleton ? (
        <div className="px-5 pb-5 space-y-4" aria-busy="true">
          <div className="h-4 w-1/3 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
        </div>
      ) : active.length === 0 ? (
        <div className="mx-5 mb-5 rounded-card border border-dashed border-slate-300 px-6 py-8 text-center">
          <p className="text-sm font-bold text-slate-700">No active Equbs</p>
          <p className="mt-1 text-sm text-slate-500">
            Join an Equb to see its lottery cycle and your eligibility.
          </p>
        </div>
      ) : showSkeleton ? (
        <div className="px-5 pb-5 space-y-4" aria-busy="true">
          <div className="h-4 w-1/3 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
        </div>
      ) : error ? (
        <p className="px-5 pb-5 text-sm text-danger-600">{error}</p>
      ) : current ? (
        <div className="px-5 pb-5 space-y-5">
          {/* Current cycle strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-card p-3 text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Cycle</p>
              <p className="text-lg font-black text-slate-900">
                {current.cycle.number}/{current.cycle.total_rounds}
              </p>
            </div>
            <div className="bg-slate-50 rounded-card p-3 text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Status</p>
              <p className="text-lg font-black text-slate-900 capitalize">{current.cycle.status}</p>
            </div>
            <div className="bg-slate-50 rounded-card p-3 text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Started</p>
              <p className="text-sm font-black text-slate-900">
                {new Date(current.cycle.started_at).toLocaleDateString()}
              </p>
            </div>
            <div className="bg-slate-50 rounded-card p-3 text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Round</p>
              <p className="text-sm font-black text-slate-900">
                {current.cycle.is_active ? 'Open' : 'Closed'}
              </p>
            </div>
          </div>

          {/* My eligibility (verbatim from the backend) */}
          <div
            className={`rounded-card border p-4 ${
              current.eligibility.eligible
                ? 'bg-green-50 border-green-200'
                : current.eligibility.won
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-black text-slate-900">My Eligibility</p>
              <span
                className={`text-xs font-black uppercase tracking-wide rounded-full px-2.5 py-1 ${
                  current.eligibility.eligible
                    ? 'bg-green-100 text-green-700'
                    : current.eligibility.won
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {current.eligibility.eligible ? 'Eligible' : current.eligibility.won ? 'Won' : 'Not eligible'}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{current.eligibility.message}</p>
            <div className="mt-3 flex items-center gap-4 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    current.eligibility.contribution === 'paid' ? 'bg-green-500' : 'bg-red-400'
                  }`}
                />
                Contribution {current.eligibility.contribution}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${current.eligibility.won ? 'bg-amber-500' : 'bg-slate-300'}`}
                />
                Won this cycle {current.eligibility.won ? '✓' : '—'}
              </span>
            </div>
          </div>

          {/* Latest winner */}
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">
              Latest Winner
            </h3>
            {current.latestWinner ? (
              <div className="flex items-center justify-between rounded-card border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-sm font-black text-slate-900">
                  🏆 {current.latestWinner.winner.displayName}
                </span>
                <span className="text-xs text-slate-400">
                  Cycle {current.latestWinner.cycle} · {new Date(current.latestWinner.drawnAt).toLocaleDateString()}
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No winner drawn for this Equb yet.</p>
            )}
          </div>

          {/* History */}
          <div>
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">
              Previous Winners
            </h3>
            {history && history.items.length > 0 ? (
              <>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-card overflow-hidden">
                  {history.items.map((h) => (
                    <li
                      key={`${h.cycle}-${h.winner.displayName}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50"
                    >
                      <span className="text-sm font-bold text-slate-800">
                        Cycle {h.cycle}
                      </span>
                      <span className="text-sm text-slate-700">🏆 {h.winner.displayName}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(h.drawnAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
                {history.total_pages > 1 && (
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={() => gotoPage(page - 1)}
                      disabled={page <= 1}
                      className="text-sm font-bold text-brand-600 hover:text-brand-700 disabled:text-slate-300 disabled:cursor-not-allowed"
                    >
                      ← Prev
                    </button>
                    <span className="text-xs font-bold text-slate-500">
                      Page {history.page} of {history.total_pages}
                    </span>
                    <button
                      onClick={() => gotoPage(page + 1)}
                      disabled={page >= history.total_pages}
                      className="text-sm font-bold text-brand-600 hover:text-brand-700 disabled:text-slate-300 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">No draws have been run yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
