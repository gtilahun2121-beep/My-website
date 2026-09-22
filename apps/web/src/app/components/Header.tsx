'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Language, languages } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import { useNotifications } from '@/app/hooks/useNotifications';
import ProfileDrawer from '@/app/components/layout/ProfileDrawer';
import NotificationsDrawer from '@/app/components/notifications/NotificationsDrawer';

interface HeaderProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onSignUpClick?: () => void;
  isAuthenticated?: boolean;
}

export default function Header({ lang, onLanguageChange, onSignUpClick, isAuthenticated = false }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const t = translations[lang];

  const { user, isAuthenticated: authAuthenticated } = useAuth();
  const authenticated = isAuthenticated || authAuthenticated;
  const { refresh } = useNotifications(authenticated);

  const navItems = [
    { label: t.home, href: '/' },
    { label: t.features, href: '/features' },
    { label: t.docs, href: '/docs' },
  ];

  const openNotifications = () => {
    refresh();
    setNotificationsOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-5 sm:px-6 lg:px-8">
        <nav className="mx-auto max-w-[1300px] rounded-full border border-white/70 bg-white/70 px-3 py-3 shadow-[0_18px_45px_rgba(59,130,246,0.12)] backdrop-blur-xl sm:px-5 lg:px-7">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <Link href="/" className="group flex shrink-0 items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-500 shadow-md ring-2 ring-white/60">
                <span className="text-base font-black text-white">QN</span>
              </div>
              <div className="hidden sm:block">
                <span className="block text-[1.8rem] font-black leading-none tracking-[-0.06em] text-blue-800">QalNet</span>
                <p className="mt-0.5 text-[0.7rem] font-medium text-blue-600">Ethiopia&apos;s Digital Equb</p>
              </div>
            </Link>

            <div className="hidden flex-1 items-center justify-center gap-8 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-[0.95rem] font-semibold transition-colors ${
                    item.href === '/'
                      ? 'rounded-full bg-blue-100 px-4 py-2 text-blue-700'
                      : 'text-blue-600 hover:text-blue-800'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <button className="flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-2 text-sm font-medium text-blue-600 shadow-sm">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 3a9 9 0 0 0 0 18m0-18a9 9 0 0 1 0 18M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>{languages[lang]}</span>
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5.25 7.5 10 12.25 14.75 7.5H5.25Z" />
                  </svg>
                </button>
              </div>

              {!authenticated && (
                <button
                  onClick={onSignUpClick}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-base font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_16px_35px_rgba(37,99,235,0.45)]"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>Sign Up</span>
                </button>
              )}

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-full p-2 text-blue-600 transition-colors hover:bg-blue-100 md:hidden"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="mt-3 space-y-2 rounded-2xl border border-blue-200 bg-white/70 p-3 backdrop-blur-md md:hidden">
              <div className="flex flex-wrap gap-2 border-b border-blue-200 pb-2">
                {(Object.keys(languages) as Language[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      onLanguageChange(l);
                      setMobileMenuOpen(false);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      lang === l ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                  >
                    {languages[l]}
                  </button>
                ))}
              </div>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-4 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {!authenticated && (
                <button
                  onClick={() => {
                    onSignUpClick?.();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                >
                  Sign Up
                </button>
              )}
            </div>
          )}
        </nav>
      </header>

      <ProfileDrawer
        isOpen={profileOpen && authenticated}
        onClose={() => setProfileOpen(false)}
        language={lang}
      />
      <NotificationsDrawer
        isOpen={notificationsOpen && authenticated}
        onClose={() => setNotificationsOpen(false)}
        language={lang}
      />
    </>
  );
}
