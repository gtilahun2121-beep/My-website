'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ShellVariant } from './Sidebar';
import ProfileMenu from '../layout/ProfileMenu';
import { useAuth } from '@/app/context/AuthContext';
import { initials } from '../dashboard/format';
import { languages, type Language } from '@/i18n/config';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  variant?: ShellVariant;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const LANG_KEY = 'qalnet_lang';

export default function TopHeader({ title, subtitle, onMenuClick, variant = 'admin' }: TopHeaderProps) {
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<Language>('en');
  const { user, signout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(LANG_KEY) : null;
    if (stored && (languages as Record<string, string>)[stored]) {
      const code = stored as Language;
      queueMicrotask(() => setLang(code));
    }
  }, []);

  const changeLang = (next: Language) => {
    setLang(next);
    if (typeof window !== 'undefined') localStorage.setItem(LANG_KEY, next);
  };

  const isAdmin = variant === 'admin';

  const handleAdminSignOut = async () => {
    await signout();
    router.replace('/');
  };

  const headerCls = isAdmin
    ? 'bg-admin-header/95 border-admin-border'
    : 'bg-card/90 border-slate-200';
  const iconBtnCls = isAdmin
    ? 'text-admin-muted hover:bg-admin-card hover:text-admin-text'
    : 'text-slate-500 hover:bg-slate-100';
  const titleCls = isAdmin ? 'text-admin-text' : 'text-slate-900';
  const subtitleCls = isAdmin ? 'text-admin-muted' : 'text-slate-400';
  const searchCls = isAdmin
    ? 'bg-admin-card border-admin-border placeholder:text-admin-disabled text-admin-text focus:ring-brand-500/40 focus:border-brand-500'
    : 'bg-slate-50 border-slate-200 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';

  return (
    <header className={`sticky top-0 z-30 backdrop-blur-md border-b ${headerCls}`}>
      <div className="flex items-center gap-4 px-4 sm:px-6 h-16">
        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={onMenuClick}
          className={`lg:hidden p-2 rounded-lg ${iconBtnCls}`}
          aria-label="Open sidebar"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" {...stroke}>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Page title */}
        <div className="min-w-0">
          <h1 className={`text-lg font-black truncate ${titleCls}`}>{title}</h1>
          {subtitle && <p className={`text-xs truncate ${subtitleCls}`}>{subtitle}</p>}
        </div>

        {variant === 'admin' && (
          <div className="hidden md:flex flex-1 max-w-md ml-auto relative">
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                isAdmin ? 'text-admin-disabled' : 'text-slate-400'
              }`}
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
              className={`w-full py-2 pl-9 pr-3 rounded-lg border text-sm focus:outline-none ${searchCls}`}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-0">
          {/* Language selector */}
          {variant === 'member' && (
            <select
              value={lang}
              onChange={(e) => changeLang(e.target.value as Language)}
              aria-label="Language"
              className="hidden md:block py-1.5 pl-2 pr-7 rounded-lg bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer"
            >
              {(Object.keys(languages) as Language[]).map((code) => (
                <option key={code} value={code}>
                  {languages[code]}
                </option>
              ))}
            </select>
          )}

          {/* Notifications */}
          <button
            type="button"
            className={`relative p-2 rounded-lg ${iconBtnCls}`}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger-500" />
          </button>

          {/* Profile */}
          {variant === 'member' ? (
            <ProfileMenu />
          ) : (
            <div
              className={`flex items-center gap-2 pl-2 border-l ${
                isAdmin ? 'border-admin-border' : 'border-slate-200'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-500 to-accent-700 text-white flex items-center justify-center text-sm font-bold shadow-md shadow-accent-900/40">
                {user ? initials(user.firstName, user.lastName) : 'AD'}
              </div>
              <div className="hidden sm:block">
                <p className={`text-sm font-bold leading-none ${isAdmin ? 'text-admin-text' : 'text-slate-800'}`}>
                  {user ? `${user.firstName} ${user.lastName}`.trim() || 'Administrator' : 'Admin'}
                </p>
                <p className={`text-xs mt-0.5 truncate max-w-[10rem] ${isAdmin ? 'text-admin-muted' : 'text-slate-400'}`}>
                  {user?.email ?? 'Administrator'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleAdminSignOut}
                aria-label="Sign out"
                title="Sign out"
                className={`p-2 rounded-lg ${iconBtnCls} hover:text-danger-500`}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
                  <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3m4 13 5-5m0 0-5-5m5 5H9" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search (mobile) — admin only */}
      {variant === 'admin' && (
        <div className="md:hidden px-4 pb-3 relative">
          <svg
            viewBox="0 0 24 24"
            className={`w-4 h-4 absolute left-7 top-2.5 ${
              isAdmin ? 'text-admin-disabled' : 'text-slate-400'
            }`}
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
            className={`w-full py-2 pl-9 pr-3 rounded-lg border focus:outline-none ${searchCls}`}
          />
        </div>
      )}
    </header>
  );
}
