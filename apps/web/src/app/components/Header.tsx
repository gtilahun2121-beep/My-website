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
    <header className="bg-gradient-to-r from-[#314fa0]/85 to-[#ce1126]/75 backdrop-blur-md shadow-2xl sticky top-0 z-50 border-b-4 border-[#d4af37]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center gap-2 sm:gap-3">
          {/* Left corner: profile + logo */}
          <div className="flex items-center gap-3">
            {/* Profile Avatar */}
            {authenticated && (
              <button
                onClick={() => setProfileOpen(true)}
                className="relative w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center text-[#314fa0] font-black text-sm uppercase shadow-md hover:scale-105 transition-transform border-2 border-[#d4af37]"
                aria-label="Open profile"
              >
                {user?.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profilePhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  initials
                )}
              </button>
            )}
            <Link href="/" className="flex items-center gap-3 group min-w-0">
            <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-[#d4af37] to-[#ce1126] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-[#314fa0] font-black text-lg">🇪🇹</span>
            </div>
            <div className="min-w-0">
              <span className="block font-black text-xl sm:text-2xl text-white drop-shadow-lg truncate">QalNet</span>
              <p className="hidden sm:block text-xs text-white/80 font-semibold -mt-1 truncate">Ethiopia&apos;s Digital Equb</p>
            </div>
          </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-white font-bold hover:text-[#d4af37] transition-all"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Notifications Bell */}
            {authenticated && (
              <button
                onClick={openNotifications}
                className="relative p-2 hover:bg-white/20 rounded-full transition-all text-white"
                aria-label="Notifications"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#ce1126] border-2 border-white rounded-full text-[10px] font-black text-white flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}

            {/* Language Selector */}
            <select
              value={lang}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="hidden sm:block px-4 py-2 border-2 border-[#d4af37] rounded-full text-sm bg-white text-[#314fa0] font-bold cursor-pointer"
            >
              {(Object.keys(languages) as Language[]).map((l) => (
                <option key={l} value={l}>
                  {languages[l]}
                </option>
              ))}
            </select>

            {/* Sign Up Button */}
            {!authenticated && (
              <button
                onClick={onSignUpClick}
                className="hidden sm:inline-block px-6 py-2 bg-gradient-to-r from-[#d4af37] via-[#ecc860] to-[#d4af37] text-[#314fa0] font-black rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all text-sm"
              >
                ✍️ Sign Up
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-white/20 rounded-full transition-all text-white font-bold"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 space-y-2 bg-white/10 backdrop-blur-md rounded-2xl p-4">
            {/* Mobile language picker */}
            <div className="flex flex-wrap gap-2 pb-2 border-b border-white/20">
              {(Object.keys(languages) as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onLanguageChange(l)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    lang === l
                      ? 'bg-white text-[#314fa0]'
                      : 'bg-white/15 text-white hover:bg-white/25'
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
                className="block px-4 py-3 text-white font-bold hover:bg-white/20 rounded-lg"
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
                className="w-full px-4 py-3 bg-white text-[#314fa0] font-bold rounded-lg"
              >
                ✍️ Sign Up
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Drawers */}
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
    </header>
  );
}
