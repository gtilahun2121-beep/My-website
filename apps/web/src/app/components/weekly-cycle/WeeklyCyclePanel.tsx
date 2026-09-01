'use client';

import { useEffect, useState } from 'react';
import api, { WeeklyCycleState } from '@/app/services/api';

interface Props {
  equbId: string;
  isHost: boolean;
  isAdmin: boolean;
  onChanged?: () => void;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Weekly-cycle panel for a weekly (cycle_type = 'weekly') Equb.
 * Fetches GET /api/v1/weekly-cycles/:equbId/state and shows the weekly payment
 * window, cutoff weekday/time and late-penalty settings, with a host/admin
 * "run cutoff now" action. Renders nothing if the equb is NOT a weekly equb
 * (state returns null).
 */
export default function WeeklyCyclePanel({ equbId, isHost, isAdmin, onChanged }: Props) {
  const [state, setState] = useState<WeeklyCycleState | null>(null);
  const [notWeekly, setNotWeekly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.weeklyCycleAPI.getState(equbId);
        if (cancelled) return;
        if (!data) {
          setNotWeekly(true);
          setLoading(false);
          return;
        }
        setState(data);
        setNotWeekly(false);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setNotWeekly(true);
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
      const result = await api.weeklyCycleAPI.runEqub(equbId);
      setNotice(result.message);
      const fresh = await api.weeklyCycleAPI.getState(equbId);
      if (fresh) setState(fresh);
      onChanged?.();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to run weekly cutoff.');
    } finally {
      setRunning(false);
    }
  };

  if (loading) return null;
  if (notWeekly) return null;
  if (!state) return null;

  const canRun = isHost || isAdmin;
  const weekday = WEEKDAY_NAMES[state.payment_cutoff_weekday] ?? 'Day 7';

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-black text-gray-900">Weekly Cycle</h2>
        <span
          className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
            state.payment_window_open
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {state.payment_window_open ? 'Payment window is open' : 'Payment window is closed'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Draw day</p>
          <p className="text-sm font-black text-gray-900">{weekday}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Cutoff time</p>
          <p className="text-sm font-black text-gray-900">{state.payment_cutoff_time}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Cycle date</p>
          <p className="text-sm font-black text-gray-900">{state.cycle_date}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Late penalty</p>
          <p className="text-sm font-black text-gray-900">
            {(state.late_penalty_rate * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Week recap</p>
        <p className="text-sm text-gray-700">
          Round {state.current_round} / {state.total_rounds} · ETB{' '}
          {state.contribution_amount.toLocaleString()} per week · 1 winner each{' '}
          {weekday} until all members are paid out.
        </p>
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
          {running ? 'Running...' : 'Run cutoff now'}
        </button>
      )}
    </div>
  );
}
