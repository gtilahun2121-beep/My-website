// ========================================================================
// LOTTERY WHEEL COMPONENT
// An SVG prize wheel that always renders (with placeholder segments when no
// draw has run yet), spins with a realistic deceleration curve, and lands on
// the backend-selected winner. The backend picks the winner with a CSPRNG and
// returns the full candidate list — this wheel is a *visualization* of that
// outcome, not the source of randomness (spec §4: transparent,
// server-authoritative lottery).
//
// Modes:
//   • Real draw   — `spinning` + `winner` from the backend; lands on the winner.
//   • Reveal spin — `autoReveal` spins on mount to the previously recorded
//                   winner so returning visitors see the wheel land on it.
//   • Preview     — `preview` spins to a random segment for hosts to
//                   demonstrate the wheel even before anyone has paid.
// ========================================================================

'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LotteryCandidate } from '@qalnet/shared-types';
import { playTick, playWin } from './lotterySounds';

interface LotteryWheelProps {
  candidates: LotteryCandidate[];
  winner: LotteryCandidate | null;
  spinning: boolean;
  preview?: boolean;
  /** Random seed [0,1) supplied by the parent when a preview spin starts. */
  previewSeed?: number;
  /** Play synthesised tick/win sounds (defaults to true). */
  soundEnabled?: boolean;
  onSpinComplete?: () => void;
}

const SEGMENT_COLORS = [
  '#314fa0', // navy
  '#0ea5a4', // teal
  '#7c3aed', // violet
  '#e11d48', // rose
  '#2563eb', // blue
  '#d97706', // amber
  '#059669', // emerald
  '#db2777', // pink
  '#4f46e5', // indigo
  '#ca8a04', // yellow-dark
];

// Placeholder segments shown before any draw so the wheel is always visible.
const PLACEHOLDER_COLORS = [
  '#314fa0',
  '#4a6ad4',
  '#314fa0',
  '#4a6ad4',
  '#314fa0',
  '#4a6ad4',
  '#314fa0',
  '#4a6ad4',
];

const WHEEL_RADIUS = 130;
const POINTER_DEG = 270; // pointer sits at 12 o'clock
const FULL_TURNS = 6;    // guaranteed full revolutions before landing

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function describeSegment(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarToCartesian(cx, cy, radius, endDeg);
  const end = polarToCartesian(cx, cy, radius, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function shortName(c: LotteryCandidate): string {
  const first = c.first_name || '';
  const last = c.last_name ? ` ${c.last_name.charAt(0)}.` : '';
  return `${first}${last}`.trim();
}

interface WheelSegment {
  id: string;
  label: string;
  color: string;
  startDeg: number;
  endDeg: number;
  centerDeg: number;
}

export const LotteryWheel: React.FC<LotteryWheelProps> = ({
  candidates,
  winner,
  spinning,
  preview = false,
  previewSeed = 0,
  soundEnabled = true,
  onSpinComplete,
}) => {
  const [rotation, setRotation] = useState(0);
  const lastTickRef = useRef(0);
  const winSoundedRef = useRef(false);

  // Emit a soft tick at a fixed cadence while the wheel is spinning.
  useEffect(() => {
    if (!spinning || !soundEnabled) return;
    const id = window.setInterval(() => {
      const now = performance.now();
      if (now - lastTickRef.current > 340) {
        lastTickRef.current = now;
        playTick();
      }
    }, 120);
    return () => window.clearInterval(id);
  }, [spinning, soundEnabled]);

  // Arm the win chime when a fresh spin starts, then celebrate once a real
  // winner is revealed.
  useEffect(() => {
    if (spinning) {
      winSoundedRef.current = false;
    }
  }, [spinning]);

  // Celebrate with a chime once a real winner is revealed.
  useEffect(() => {
    if (!spinning && winner && !preview && soundEnabled && !winSoundedRef.current) {
      winSoundedRef.current = true;
      playWin();
    }
  }, [spinning, winner, preview, soundEnabled]);

  // Build segments. Real candidates take priority; otherwise placeholder
  // segments keep the wheel visible and spinable before any draw.
  const segments: WheelSegment[] = useMemo(() => {
    if (candidates.length > 0) {
      const segDeg = 360 / candidates.length;
      return candidates.map((c, i) => ({
        id: c.id,
        label: shortName(c),
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        startDeg: i * segDeg,
        endDeg: (i + 1) * segDeg,
        centerDeg: i * segDeg + segDeg / 2,
      }));
    }
    const segDeg = 360 / 8;
    return Array.from({ length: 8 }, (_, i) => ({
      id: `ph-${i}`,
      label: '?',
      color: PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length],
      startDeg: i * segDeg,
      endDeg: (i + 1) * segDeg,
      centerDeg: i * segDeg + segDeg / 2,
    }));
  }, [candidates]);

  // Landing target:
  //   • real winner present → rotate so winner's center rests under the pointer
  //   • preview spin        → rotate to a random segment (visual demo only)
  //   • otherwise           → keep current rotation
  const targetRotation = useMemo(() => {
    if (segments.length === 0) return rotation;

    let targetIndex = -1;
    if (preview) {
      targetIndex = Math.floor(previewSeed * segments.length) % segments.length;
    } else if (winner) {
      targetIndex = segments.findIndex((s) => s.id === winner.id);
    }
    if (targetIndex === -1) return rotation;

    const winnerCenter = segments[targetIndex].centerDeg;
    const finalMod = (POINTER_DEG - winnerCenter + 360) % 360;
    const nextMultiple = Math.ceil(rotation / 360) * 360;
    return nextMultiple + 360 * FULL_TURNS + finalMod;
  }, [segments, winner, preview, previewSeed, rotation]);

  const displayRotation = spinning ? targetRotation : rotation;

  const handleSpinComplete = useCallback(() => {
    setRotation(targetRotation);
    onSpinComplete?.();
  }, [targetRotation, onSpinComplete]);

  const cx = WHEEL_RADIUS + 10;
  const cy = WHEEL_RADIUS + 10;
  const size = (WHEEL_RADIUS + 10) * 2;

  const showWinnerBanner = !!winner && !spinning && !preview;
  const showConfetti = showWinnerBanner && candidates.length > 0;

  // Winner's segment glows while the wheel is stationary so the result is
  // unmistakable even on a busy page.
  const winnerId = !spinning && !preview ? winner?.id : null;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Pointer */}
        <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
          <svg width="34" height="38" viewBox="0 0 34 38" className="drop-shadow-md">
            <path d="M17 2 L29 34 L17 27 L5 34 Z" fill="#e11d48" />
          </svg>
        </div>

        {/* Rim lights (decorative bulbs) */}
        <div className="absolute -inset-3 rounded-full pointer-events-none">
          {Array.from({ length: 12 }).map((_, i) => {
            const ang = (i * 30 - 90) * (Math.PI / 180);
            const r = size / 2 + 6;
            return (
              <span
                key={i}
                className="absolute w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_6px_rgba(253,224,71,0.9)]"
                style={{
                  left: `${size / 2 + r * Math.cos(ang) - 4}px`,
                  top: `${size / 2 + r * Math.sin(ang) - 4}px`,
                }}
              />
            );
          })}
        </div>

        <motion.div
          className="absolute inset-0"
          style={{ willChange: 'transform' }}
          animate={{ rotate: displayRotation }}
          transition={{ duration: 5, ease: [0.1, 0.7, 0.05, 1] }}
          onAnimationComplete={handleSpinComplete}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="drop-shadow-2xl"
          >
            {segments.map((s) => {
              const isWinnerSegment = winnerId === s.id;
              return (
                <g key={s.id}>
                  {isWinnerSegment ? (
                    <motion.path
                      d={describeSegment(cx, cy, WHEEL_RADIUS + 4, s.startDeg, s.endDeg)}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="6"
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                    />
                  ) : null}
                  <path
                    d={describeSegment(cx, cy, WHEEL_RADIUS, s.startDeg, s.endDeg)}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={polarToCartesian(cx, cy, WHEEL_RADIUS * 0.66, s.centerDeg).x}
                    y={polarToCartesian(cx, cy, WHEEL_RADIUS * 0.66, s.centerDeg).y}
                    fill="#ffffff"
                    fontSize={s.label.length > 12 ? 11 : 13}
                    fontWeight={isWinnerSegment ? 900 : 700}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {s.label.slice(0, 14)}
                  </text>
                </g>
              );
            })}
            <circle cx={cx} cy={cy} r="34" fill="#1f2937" stroke="#ffffff" strokeWidth="4" />
            <circle cx={cx} cy={cy} r="26" fill="#314fa0" stroke="#ffffff" strokeWidth="2" />
            <text
              x={cx}
              y={cy}
              fill="#ffffff"
              fontSize="11"
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              QalNet
            </text>
          </svg>
        </motion.div>
      </div>

      {/* Winner reveal */}
      <AnimatePresence>
        {showWinnerBanner && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="text-center bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-3"
          >
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">
              Round Winner
            </p>
            <p className="text-lg font-black text-emerald-800">
              🏆 {winner.first_name} {winner.last_name}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confetti burst on a real win */}
      {showConfetti && (
        <div className="relative w-72 h-0 pointer-events-none" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            const dist = 90 + (i % 5) * 18;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            return (
              <motion.span
                key={i}
                className="absolute w-2 h-2 rounded-sm"
                style={{ left: '50%', top: 0, backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{ x: dx, y: dy, opacity: 0, rotate: 360 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            );
          })}
        </div>
      )}

      {/* Helper text for hosts before anyone has paid */}
      {candidates.length === 0 && !spinning && (
        <p className="text-sm text-gray-400 text-center">
          {preview
            ? 'Preview mode — a real draw runs once members pay this round.'
            : 'The wheel appears here. Members appear once they pay the round, then the host can run the draw.'}
        </p>
      )}

      {/* Eligible members — who is in the running this round */}
      {candidates.length > 0 && (
        <div className="w-full max-w-md">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 text-center">
            Eligible for this round · {candidates.length} member{candidates.length !== 1 ? 's' : ''}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {candidates.map((c) => {
              const isWinner = winnerId === c.id;
              return (
                <span
                  key={c.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    isWinner
                      ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  {isWinner && <span aria-hidden>🏆</span>}
                  {c.first_name} {c.last_name.charAt(0)}.
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};