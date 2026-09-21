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
  const { unreadCount, refresh } = useNotifications(authenticated);

  const initials =
    (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '') || '👤';

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
    <header className="bg-gradient-to-b from-blue-100 to-blue-50 shadow-lg sticky top-0 z-50 border-b border-blue-200">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex justify-between items-center gap-3 sm:gap-4">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
              <span className="text-white font-black text-sm">QN</span>
            </div>
            <div className="hidden sm:block">
              <span className="block font-black text-lg text-blue-800">QalNet</span>
              <p className="text-xs text-blue-600 font-medium -mt-1">Ethiopia's Digital Equb</p>
            </div>
          </Link>

          {/* Center Navigation (Desktop) */}
          <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-blue-600 font-semibold hover:text-blue-800 transition-colors text-sm"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Language Selector */}
            <div className="hidden sm:flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 00.948-.684l1.498-4.493a1 1 0 011.502 0l1.498 4.493a1 1 0 00.948.684H19a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
              </svg>
              <select
                value={lang}
                onChange={(e) => onLanguageChange(e.target.value as Language)}
                className="px-3 py-1.5 border border-blue-300 rounded-full text-xs bg-white text-blue-600 font-semibold cursor-pointer hover:bg-blue-50 transition-colors"
              >
                {(Object.keys(languages) as Language[]).map((l) => (
                  <option key={l} value={l}>
                    {languages[l]}
                  </option>
                ))}
              </select>
            </div>

            {/* Sign Up Button */}
            {!authenticated && (
              <button
                onClick={onSignUpClick}
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white font-bold rounded-full shadow-md hover:bg-blue-700 hover:shadow-lg transition-all text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Sign Up
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-blue-200 rounded-full transition-all text-blue-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 space-y-2 bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-blue-200">
            {/* Mobile language picker */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-blue-200">
              {(Object.keys(languages) as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    onLanguageChange(l);
                    setMobileMenuOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    lang === l
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
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
                className="block px-4 py-2 text-blue-600 font-semibold hover:bg-blue-100 rounded-lg text-sm transition-colors"
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
                className="w-full px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                Sign Up
              </button>
            )}
          </div>
        )}
      </nav>
    </header>

    {/* Drawers (Rendered outside the header to avoid backdrop-blur containing block breaking fixed positioning) */}
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
