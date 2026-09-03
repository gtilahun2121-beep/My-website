// ========================================================================
// LOTTERY PANEL COMPONENT
// Mounted on the Equb detail page. Lets hosts/admins run the lottery draw
// for the current round, animates the prize wheel onto the backend-chosen
// winner, and shows the draw history. Any authenticated member can view it.
// ========================================================================

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import api from '@/app/services/api';
import type {
  LotteryDrawResponse,
  LotteryDrawListResponse,
  LotteryCandidate,
} from '@qalnet/shared-types';
import { LotteryWheel } from './LotteryWheel';

interface LotteryPanelProps {
  equbId: string;
  isHost: boolean;
  isAdmin: boolean;
  isActive: boolean;
  /** Current round number (for labelling the panel). */
  currentRound?: number;
  /** Total rounds in the Equb. */
  totalRounds?: number;
  /** Pot value for the current round (ETB). */
  potAmount?: number;
  /** Called after a draw succeeds so the parent can refresh round/status. */
  onChange?: () => void;
}

export const LotteryPanel: React.FC<LotteryPanelProps> = ({
  equbId,
  isHost,
  isAdmin,
  isActive,
  currentRound,
  totalRounds,
  potAmount,
  onChange,
}) => {
  const canDraw = (isHost || isAdmin) && isActive;

  const [history, setHistory] = useState<LotteryDrawListResponse | null>(null);
  const [candidates, setCandidates] = useState<LotteryCandidate[]>([]);
  const [winner, setWinner] = useState<LotteryCandidate | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const revealPending = React.useRef<boolean>(false);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.equbAPI.getDraws(equbId);
      setHistory(data);
      if (data.latest_draw) {
        setCandidates(data.latest_draw.candidates);
        setWinner(data.latest_draw.winner);
      }
    } catch {
      setError('Could not load lottery history.');
    }
  }, [equbId]);

  useEffect(() => {
    let cancelled = false;
    api.equbAPI
      .getDraws(equbId)
      .then((data) => {
        if (cancelled) return;
        setHistory(data);
        if (data.latest_draw) {
          setCandidates(data.latest_draw.candidates);
          setWinner(data.latest_draw.winner);
          // Reveal-spin: when a previous winner is already recorded, spin the
          // wheel onto it on page load so visitors see the result live.
          if (!revealPending.current) {
            revealPending.current = true;
            setTimeout(() => setSpinning(true), 300);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load lottery history.');
      });
    return () => {
      cancelled = true;
    };
  }, [equbId]);

  const handleRunDraw = async () => {
    setError(null);
    setRunning(true);
    setWinner(null);
    setSpinning(true);
    setPreviewing(false);
    try {
      const res: LotteryDrawResponse = await api.equbAPI.runDraw(equbId);
      setCandidates(res.candidates);
      setWinner(res.winner);
      await loadHistory();
      onChange?.();
    } catch (err) {
      setSpinning(false);
      setError(err instanceof Error ? err.message : 'Failed to run the lottery draw.');
    } finally {
      setRunning(false);
    }
  };

  const handlePreviewSpin = () => {
    setError(null);
    setWinner(null);
    setPreviewSeed(Math.random());
    setSpinning(true);
    setPreviewing(true);
  };

  const handleSpinComplete = () => {
    setSpinning(false);
    setPreviewing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 sm:p-8 mt-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-xl font-black text-[#00d9ff] mb-1">
            🎰 {isHost || isAdmin ? 'Lottery Draw' : 'Lottery Results'}
          </h2>
          <p className="text-sm text-gray-500">
            {isHost || isAdmin
              ? 'Spin the wheel to pick this round’s pot winner.'
              : 'The winner is chosen randomly from members who paid this round.'}
          </p>
        </div>

        {canDraw && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunDraw}
              disabled={running || spinning}
              className={`px-5 py-2.5 rounded-lg font-black text-[#00d9ff] transition-all ${
                running || spinning
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-[#001f3f] hover:bg-[#001f3f]'
              }`}
            >
              {running || spinning ? 'Spinning…' : '🎰 Run Draw'}
            </button>
            <button
              onClick={handlePreviewSpin}
              disabled={running || spinning}
              className={`px-4 py-2.5 rounded-lg font-bold transition-all ${
                running || spinning
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-[#00d9ff] hover:bg-gray-200'
              }`}
            >
              🔄 Preview Spin
            </button>
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              aria-pressed={soundEnabled}
              aria-label={soundEnabled ? 'Mute lottery sounds' : 'Enable lottery sounds'}
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
              className="w-9 h-9 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all text-sm"
            >
              {soundEnabled ? '🔊' : '🔇'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-brand-50 border border-brand-200 text-brand-700 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Round / pot / odds strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Round</p>
          <p className="text-lg font-black text-[#00d9ff]">
            {currentRound && totalRounds ? `${currentRound}/${totalRounds}` : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Pot</p>
          <p className="text-lg font-black text-[#00d9ff]">
            {potAmount ? `ETB ${Number(potAmount).toLocaleString()}` : '—'}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Eligible</p>
          <p className="text-lg font-black text-[#00d9ff]">{candidates.length}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Draws</p>
          <p className="text-lg font-black text-[#00d9ff]">{history?.total ?? 0}</p>
        </div>
      </div>

      {/* Wheel — candidates are loaded after the first draw; the wheel also
          works standalone when a draw has already been recorded. */}
      <LotteryWheel
        candidates={candidates}
        winner={winner}
        spinning={spinning}
        preview={previewing}
        previewSeed={previewSeed}
        soundEnabled={soundEnabled}
        onSpinComplete={handleSpinComplete}
      />

      {/* Transparency note */}
      <p className="text-center text-xs text-gray-400 mt-6">
        🔒 Winner selected on the server with a cryptographically secure random
        generator — the wheel is the visual result, not the source of luck.
      </p>

      {/* History */}
      {history && history.total > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-black text-[#00d9ff] text-gray-500 uppercase tracking-wide mb-3">
            Previous Winners
          </h3>
          <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
            {history.items.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between px-4 py-3 bg-gray-50 text-sm"
              >
                <span className="font-bold text-[#00d9ff]">
                  Round {d.round_number}
                </span>
                <span className="text-[#00d9ff]">
                  🏆 {d.winner_first_name} {d.winner_last_name}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(d.draw_timestamp).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!history?.total && !canDraw && !spinning && (
        <p className="text-center text-gray-400 text-sm mt-4">
          No draws have been run yet for this Equb.
        </p>
      )}
    </div>
  );
};

