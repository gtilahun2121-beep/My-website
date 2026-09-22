'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EqubGroup, UserLotteryCurrentResponse, UserLotteryHistoryResponse } from '@qalnet/shared-types';
import type { LotteryDrawResponse, LotteryDrawListResponse, LotteryCandidate } from '@qalnet/shared-types';
import api from '@/app/services/api';
import { LotteryWheel } from '@/app/components/lottery/LotteryWheel';
import { useAuth } from '@/app/context/AuthContext';

interface LotterySectionProps {
  equbs: EqubGroup[];
  loading?: boolean;
}

const LIMIT = 5;

export default function LotterySection({ equbs, loading }: LotterySectionProps) {
  const { user } = useAuth();
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

  // Spinning-wheel state — the dashboard mirrors the equb detail page:
  // any member sees the recorded winner spin in; hosts/admins can run a draw.
  const [candidates, setCandidates] = useState<LotteryCandidate[]>([]);
  const [wheelWinner, setWheelWinner] = useState<LotteryCandidate | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(0);
  const [running, setRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const revealPendingRef = useRef(false);

  const selectedId = equbId || active[0]?.id || '';
  const selectedEqub = active.find((e) => e.id === selectedId) ?? null;
  const canDraw =
    Boolean(selectedEqub) &&
    (selectedEqub?.status === 'active' ||
      (selectedEqub?.status === 'open' && user?.role === 'admin'));

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

  // Reveal-spin: whenever the selected equb changes, load the recorded draw
  // (if any) and spin the wheel onto its winner so visitors see the result.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    api.equbAPI
      .getDraws(selectedId)
      .then((data: LotteryDrawListResponse) => {
        if (cancelled) return;
        setCandidates(data.latest_draw?.candidates ?? []);
        setWheelWinner(data.latest_draw?.winner ?? null);
        if (data.latest_draw && !revealPendingRef.current) {
          revealPendingRef.current = true;
          setTimeout(() => setSpinning(true), 300);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // No draws yet (404) is fine — the wheel will show placeholder segments.
        setCandidates([]);
        setWheelWinner(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selectEqub = (id: string) => {
    setEqubId(id);
    setPage(1);
    setBusy(true);
    revealPendingRef.current = false;
  };

  const gotoPage = (p: number) => {
    setPage(p);
    setBusy(true);
  };

  const handleRunDraw = async () => {
    if (!selectedId) return;
    setError(null);
    setRunning(true);
    setWheelWinner(null);
    setSpinning(true);
    setPreviewing(false);
    try {
      const res: LotteryDrawResponse = await api.equbAPI.runDraw(selectedId);
      setCandidates(res.candidates);
      setWheelWinner(res.winner);
      // Refresh the public status so eligibility/"Latest Winner" update too.
      const [c, h] = await Promise.all([
        api.equbAPI.getLotteryCurrent(selectedId),
        api.equbAPI.getLotteryHistory(selectedId, { page: 1, limit: LIMIT }),
      ]);
      setCurrent(c);
      setHistory(h);
      setPage(1);
    } catch (err) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : 'Failed to run the lottery draw.');
    } finally {
      setRunning(false);
    }
  };

  const handlePreviewSpin = () => {
    setError(null);
    setWheelWinner(null);
    setPreviewSeed(Math.random());
    setSpinning(true);
    setPreviewing(true);
  };

  const handleSpinComplete = () => {
    setSpinning(false);
    setPreviewing(false);
  };

  const showSkeleton = isLoading && !current && !error;

  return (
    <section className="bg-card rounded-card border border-slate-200">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-black text-slate-900">Lottery</h2>

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
        <div className="px-4 pb-4 space-y-3" aria-busy="true">
          <div className="h-4 w-1/3 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-slate-100 animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
        </div>
      ) : active.length === 0 ? (
        <div className="mx-4 mb-4 rounded-card border border-dashed border-slate-300 px-6 py-6 text-center">
          <p className="text-sm font-bold text-slate-700">No active Equbs</p>
          <p className="mt-1 text-sm text-slate-500">
            Join an Equb to see its lottery cycle and your eligibility.
          </p>
        </div>
      ) : error ? (
        <p className="px-4 pb-4 text-sm text-danger-600">{error}</p>
      ) : current ? (
        <div className="px-4 pb-4 space-y-4">
          {/* Current cycle strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 rounded-card p-2.5 text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Cycle</p>
              <p className="text-base font-black text-slate-900">
                {current.cycle.number}/{current.cycle.total_rounds}
              </p>
            </div>
            <div className="bg-slate-50 rounded-card p-2.5 text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Pot</p>
              <p className="text-sm font-black text-slate-900">
                {selectedEqub ? `ETB ${Number(selectedEqub.total_amount).toLocaleString()}` : '—'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-card p-2.5 text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Eligible</p>
              <p className="text-base font-black text-slate-900">{candidates.length}</p>
            </div>
            <div className="bg-slate-50 rounded-card p-2.5 text-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Round</p>
              <p className="text-sm font-black text-slate-900">
                {current.cycle.is_active ? 'Open' : 'Closed'}
              </p>
            </div>
          </div>

          {/* Spinning wheel — reusable dashboard edition of the equb detail page */}
          <div className="py-1">
            {canDraw && (
              <div className="flex items-center justify-center gap-2 flex-wrap mb-3">
                <button
                  onClick={handleRunDraw}
                  disabled={running || spinning}
                  className={`px-4 py-2 rounded-lg font-black text-white text-sm transition-all ${
                    running || spinning
                      ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                      : 'bg-[#0066ff] hover:bg-[#0047b3]'
                  }`}
                >
                  {running || spinning ? 'Spinning…' : '🎰 Run Draw'}
                </button>
                <button
                  onClick={handlePreviewSpin}
                  disabled={running || spinning}
                  className={`px-3 py-2 rounded-lg font-bold text-sm transition-all ${
                    running || spinning
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-100 text-[#0066ff] hover:bg-slate-200'
                  }`}
                >
                  🔄 Preview Spin
                </button>
                <button
                  onClick={() => setSoundEnabled((v) => !v)}
                  aria-pressed={soundEnabled}
                  aria-label={soundEnabled ? 'Mute lottery sounds' : 'Enable lottery sounds'}
                  title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                  className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all text-sm"
                >
                  {soundEnabled ? '🔊' : '🔇'}
                </button>
              </div>
            )}
            <LotteryWheel
              candidates={candidates}
              winner={wheelWinner}
              spinning={spinning}
              preview={previewing}
              previewSeed={previewSeed}
              soundEnabled={soundEnabled}
              radius={92}
              onSpinComplete={handleSpinComplete}
            />
            <p className="text-center text-[11px] text-slate-400 mt-3">
              🔒 Winner selected on the server with a cryptographically secure random
              generator — the wheel is the visual result, not the source of luck.
            </p>
          </div>

          {/* My eligibility (verbatim from the backend) */}
          <div
            className={`rounded-card border p-3.5 ${
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
            <div className="mt-2 flex items-center gap-4 text-xs font-bold text-slate-500">
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
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">
              Latest Winner
            </h3>
            {current.latestWinner ? (
              <div className="flex items-center justify-between rounded-card border border-slate-200 bg-slate-50 px-3.5 py-2.5">
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
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">
              Previous Winners
            </h3>
            {history && history.items.length > 0 ? (
              <>
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-card overflow-hidden">
                  {history.items.map((h) => (
                    <li
                      key={`${h.cycle}-${h.winner.displayName}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 bg-slate-50"
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
                  <div className="mt-2 flex items-center justify-between">
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