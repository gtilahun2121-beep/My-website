'use client';

import { useEffect, useRef, useState } from 'react';
import type { ShellVariant } from './Sidebar';
import ProfileMenu from '../layout/ProfileMenu';
import NotificationsDrawer from '../notifications/NotificationsDrawer';
import { useAuth } from '@/app/context/AuthContext';
import { useNotifications } from '@/app/hooks/useNotifications';
import { languages, type Language } from '@/i18n/config';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  variant?: ShellVariant;
  menuButtonRef?: React.Ref<HTMLButtonElement>;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const LANG_KEY = 'qalnet_lang';

export default function TopHeader({ title, subtitle, onMenuClick, variant = 'admin', menuButtonRef }: TopHeaderProps) {
  const [search, setSearch] = useState('');
  const [lang, setLang] = useState<Language>('en');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { isAuthenticated } = useAuth();
  const { unreadCount, refresh } = useNotifications(isAuthenticated);

  /* Ctrl/Cmd + K focuses global search */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Browser fullscreen toggle */
  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

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

  const openNotifications = () => {
    refresh();
    setNotificationsOpen(true);
  };

  const isAdmin = variant === 'admin';

  const headerCls = isAdmin
    ? 'bg-admin-header border-admin-border'
    : 'bg-card border-gray-200';
  const iconBtnCls = isAdmin
    ? 'text-admin-muted hover:bg-admin-card hover:text-admin-text'
    : 'text-gray-500 hover:bg-gray-100';
  const titleCls = isAdmin ? 'text-admin-text' : 'text-[#0066ff]';
  const subtitleCls = isAdmin ? 'text-admin-muted' : 'text-gray-400';
  const searchCls = isAdmin
    ? 'bg-admin-card border-admin-border placeholder:text-admin-disabled text-admin-text focus:ring-brand-500/40 focus:border-brand-500'
    : 'bg-gray-50 border-gray-200 text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500';

  return (
    <>
      <header className={`sticky top-0 z-30 border-b ${headerCls}`}>
      <div className="flex items-center gap-4 px-4 sm:px-6 h-16">
        {/* Mobile menu toggle */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={onMenuClick}
          className={`lg:hidden p-2 rounded-lg ${iconBtnCls}`}
          aria-label={isAdmin ? 'Open admin navigation' : 'Open navigation'}
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
                isAdmin ? 'text-admin-disabled' : 'text-gray-400'
              }`}
              {...stroke}
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members, transactions, wallets…"
              aria-label="Search members, transactions and wallets"
              className={`w-full py-2 pl-9 pr-14 rounded-lg border text-sm focus:outline-none ${searchCls}`}
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-admin-border bg-admin-card text-[10px] font-bold text-admin-disabled">
              Ctrl K
            </kbd>
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
              className="hidden md:block py-1.5 pl-2 pr-7 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 cursor-pointer"
            >
              {(Object.keys(languages) as Language[]).map((code) => (
                <option key={code} value={code}>
                  {languages[code]}
                </option>
              ))}
            </select>
          )}

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-2 rounded-lg ${iconBtnCls}`}
            aria-label="Toggle fullscreen"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={openNotifications}
            className={`relative p-2 rounded-lg ${iconBtnCls}`}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
              <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger-500 border-2 border-white text-[10px] font-black text-[#0066ff] flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile */}
          <ProfileMenu />
        </div>
      </div>

      {/* Search (mobile) — admin only */}
      {variant === 'admin' && (
        <div className="md:hidden px-4 pb-3 relative">
          <svg
            viewBox="0 0 24 24"
            className={`w-4 h-4 absolute left-7 top-2.5 ${
              isAdmin ? 'text-admin-disabled' : 'text-gray-400'
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

      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        language={lang}
      />
    </>
  );
}
