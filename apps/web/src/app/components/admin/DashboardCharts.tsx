'use client';

import { useMemo, useState } from 'react';

/**
 * DashboardCharts.tsx
 *
 * Lightweight, dependency-free SVG charts used by the admin dashboard.
 * (Recharts/Chart.js are not installed — these cover the platform-activity
 * area chart and the payment-health donut without extra bundles.)
 */

// ---------------------------------------------------------------------------
// Area / line chart
// ---------------------------------------------------------------------------

export interface AreaChartPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: AreaChartPoint[];
  height?: number;
  color?: string;
  valueFormatter?: (value: number) => string;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const W = 640;
const PAD = { top: 16, right: 12, bottom: 28, left: 44 };

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return points.length ? `M ${points[0].x} ${points[0].y}` : '';
  const d = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const mx = (prev.x + cur.x) / 2;
    d.push(`C ${mx} ${prev.y}, ${mx} ${cur.y}, ${cur.x} ${cur.y}`);
  }
  return d.join(' ');
}

export function AreaChart({
  data,
  height = 240,
  color = '#2563eb',
  valueFormatter,
}: AreaChartProps) {
  const H = height;

  const view = useMemo(() => {
    const max = Math.max(1, ...data.map((d) => d.value));
    const min = 0;
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const step = data.length > 1 ? innerW / (data.length - 1) : 0;

    const points = data.map((d, i) => ({
      x: PAD.left + i * step,
      y: PAD.top + innerH - ((d.value - min) / (max - min)) * innerH,
    }));

    const area =
      points.length > 1
        ? `${smoothPath(points)} L ${points[points.length - 1].x} ${PAD.top + innerH} L ${points[0].x} ${PAD.top + innerH} Z`
        : '';

    const gridLines = 4;
    const grid = Array.from({ length: gridLines + 1 }, (_, i) => {
      const ratio = i / gridLines;
      const y = PAD.top + innerH - ratio * innerH;
      const value = min + (max - min) * ratio;
      return { y, value };
    });

    return { points, area, grid, max, innerW };
  }, [data, H]);

  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-sm text-slate-400">
        No activity data yet.
      </div>
    );
  }

  const tickCount = Math.min(6, data.length);
  const tickStep = Math.max(1, Math.floor(data.length / tickCount));

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Platform activity line chart"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines + y labels */}
        {view.grid.map((g, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              y1={g.y}
              x2={W - PAD.right}
              y2={g.y}
              className="stroke-slate-200"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={g.y + 4}
              textAnchor="end"
              className="fill-slate-400 text-[10px]"
            >
              {valueFormatter ? valueFormatter(g.value) : Math.round(g.value)}
            </text>
          </g>
        ))}

        {/* Area + line */}
        <path d={view.area} fill="url(#area-fill)" />
        <path d={smoothPath(view.points)} fill="none" stroke={color} strokeWidth={2.5} />

        {/* Markers */}
        {view.points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3} fill="#fff" stroke={color} strokeWidth={2.5} />
            {hover === i && (
              <g pointerEvents="none">
                <line x1={p.x} y1={PAD.top} x2={p.x} y2={H - PAD.bottom} className="stroke-slate-300" strokeDasharray="3 3" />
                <g>
                  <rect
                    x={Math.max(0, Math.min(W - 120, p.x - 60))}
                    y={Math.max(2, p.y - 44)}
                    rx={6}
                    width={120}
                    height={32}
                    className="fill-slate-900"
                  />
                  <text
                    x={Math.max(60, Math.min(W - 60, p.x))}
                    y={Math.max(24, p.y - 24)}
                    textAnchor="middle"
                    className="fill-white text-[10px] font-bold"
                  >
                    {data[i].label}: {valueFormatter ? valueFormatter(data[i].value) : data[i].value}
                  </text>
                </g>
              </g>
            )}
          </g>
        ))}

        {/* X labels */}
        {data.map((d, i) =>
          i % tickStep === 0 || i === data.length - 1 ? (
            <text
              key={i}
              x={view.points[i].x}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400 text-[10px]"
            >
              {d.label}
            </text>
          ) : null,
        )}
      </svg>

      {/* Transparent hit areas for hover */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full -mt-[2px]" preserveAspectRatio="none">
        {view.points.map((p, i) => (
          <rect
            key={i}
            x={i === 0 ? 0 : (p.x + (view.points[i - 1]?.x ?? p.x)) / 2}
            y={0}
            width={i === 0 ? (view.points[1]?.x ?? W) / 2 : i === view.points.length - 1 ? W - (p.x + (view.points[i - 1]?.x ?? p.x)) / 2 : ((view.points[i + 1]?.x ?? W) - (view.points[i - 1]?.x ?? 0)) / 2}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donut chart
// ---------------------------------------------------------------------------

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  centerSubtitle?: string;
}

export function DonutChart({ segments, size = 180, thickness = 18, centerTitle, centerSubtitle }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;

  const arcs = segments.reduce<{ label: string; value: number; color: string; dash: number; offset: number }[]>(
    (list, s) => {
      const acc = list.reduce((sum, x) => sum + x.value, 0);
      const fraction = total > 0 ? Math.max(0, s.value) / total : 0;
      const dash = fraction * c;
      const offset = -(acc / total) * c;
      list.push({ label: s.label, value: Math.max(0, s.value), color: s.color, dash, offset });
      return list;
    },
    [],
  );

  return (
    <div className="flex items-center gap-6 flex-wrap justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90" role="img" aria-label="Payment health donut chart">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f7" strokeWidth={thickness} />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(0, arc.dash - 2)} ${c - Math.max(0, arc.dash - 2)}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerTitle && <span className="text-2xl font-black text-slate-900">{centerTitle}</span>}
          {centerSubtitle && <span className="text-xs font-semibold text-slate-400">{centerSubtitle}</span>}
        </div>
      </div>
      <ul className="space-y-2">
        {arcs.map((arc) => (
          <li key={arc.label} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="font-semibold text-slate-600">{arc.label}</span>
            <span className="ml-auto pl-3 font-bold text-slate-900">{total > 0 ? Math.round((Math.max(0, arc.value) / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mini stat row (used in Top Equbs / Pending Actions)
// ---------------------------------------------------------------------------

export function TrendingChip({ direction, children }: { direction: 'up' | 'down'; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold ${
        direction === 'up' ? 'text-success-700' : 'text-danger-600'
      }`}
    >
      <svg viewBox="0 0 24 24" className={`w-3 h-3 ${direction === 'up' ? '' : 'rotate-180'}`} {...stroke}>
        <path d="m4 14 6-6 4 4 6-6m0 0v4m0-4h-4" />
      </svg>
      {children}
    </span>
  );
}

