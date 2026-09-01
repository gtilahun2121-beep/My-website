'use client';

import { useEffect, useState } from 'react';
import api, { DailyCycleState } from '@/app/services/api';

interface Props {
  equbId: string;
  isHost: boolean;
  isAdmin: boolean;
  onChanged?: () => void;
}

interface Localized {
  t: (key: string) => string;
  lang: string;
}

/**
 * Daily-cycle panel for a daily (cycle_type = 'daily') Equb.
 * Fetches GET /api/v1/daily-cycles/:equbId/state and shows the payment window,
 * cutoff and late-penalty settings, with a host/admin "run cutoff now" action.
 * Renders nothing if the equb is NOT a daily equb (state returns null).
 */
export default function DailyCyclePanel({
  equbId,
  isHost,
  isAdmin,
  onChanged,
  i18n,
}: Props & { i18n?: Localized }) {
  const [state, setState] = useState<DailyCycleState | null>(null);
  const [notDaily, setNotDaily] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const text = {
    title: 'Daily Cycle',
    windowOpen: 'Payment window is open',
    windowClosed: 'Payment window is closed',
    cutoff: 'Cutoff time',
    penalty: 'Late penalty',
    cycleDate: 'Cycle date',
    status: 'Status',
    run: 'Run cutoff now',
    running: 'Running...',
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.dailyCycleAPI.getState(equbId);
        if (cancelled) return;
        if (!data) {
          setNotDaily(true);
          setLoading(false);
          return;
        }
        setState(data);
        setNotDaily(false);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setNotDaily(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [equbId]);

  const handleRun = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const result = await api.dailyCycleAPI.runEqub(equbId);
      setNotice(result.message);
      const fresh = await api.dailyCycleAPI.getState(equbId);
      if (fresh) setState(fresh);
      onChanged?.();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to run daily cutoff.');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return null;
  if (notDaily) return null;
  if (!state) return null;

  const canRun = isHost || isAdmin;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-black text-gray-900">{text.title}</h2>
        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
            state.payment_window_open
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {state.payment_window_open ? text.windowOpen : text.windowClosed}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">{text.cycleDate}</p>
          <p className="text-sm font-black text-gray-900">{state.cycle_date}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">{text.cutoff}</p>
          <p className="text-sm font-black text-gray-900">{state.payment_cutoff_time}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">{text.status}</p>
          <p className="text-sm font-black text-gray-900">{state.cycle_status}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">{text.penalty}</p>
          <p className="text-sm font-black text-gray-900">
            {(state.late_penalty_rate * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {notice && (
        <div className="border rounded-lg p-3 mb-4 bg-blue-50 border-blue-300 text-blue-800 text-sm">
          {notice}
        </div>
      )}

      {canRun && (
        <button
          onClick={handleRun}
          disabled={running}
          className={`w-full py-3 font-black rounded-lg transition-all ${
            running
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {running ? text.running : text.run}
        </button>
      )}
    </div>
  );
}
