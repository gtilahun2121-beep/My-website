'use client';

import { useState } from 'react';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export default function TopHeader({ title, subtitle, onMenuClick }: TopHeaderProps) {
  const [search, setSearch] = useState('');

  return (
    <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center gap-4 px-4 sm:px-6 h-16">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          aria-label="Open sidebar"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Page title */}
        <div className="min-w-0">
          <h1 className="text-lg font-black text-slate-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>

        {/* Search (desktop) */}
        <div className="hidden md:flex flex-1 max-w-md ml-auto relative">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            {...stroke}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers, transactions…"
            className="w-full py-2 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-0">
          {/* Notifications */}
          <button
            type="button"
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500" />
          </button>

          {/* Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-9 h-9 rounded-full bg-accent-600 text-white flex items-center justify-center text-sm font-bold">
              AD
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-800 leading-none">Admin</p>
              <p className="text-xs text-slate-400 mt-0.5">Super Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search (mobile) */}
      <div className="md:hidden px-4 pb-3 relative">
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 absolute left-7 top-2.5 text-slate-400"
          {...stroke}
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="w-full py-2 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
        />
      </div>
    </header>
  );
}
