'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Language, languages } from '@/i18n/config';
import { translations } from '@/i18n/translations';

interface HeaderProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  onSignUpClick?: () => void;
  isAuthenticated?: boolean;
}

export default function Header({ lang, onLanguageChange, onSignUpClick, isAuthenticated = false }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = translations[lang];

  const navItems = [
    { label: t.home, href: '/' },
    { label: t.features, href: '/features' },
    { label: t.docs, href: '/docs' },
  ];

  return (
    <header className="bg-gradient-to-r from-[#0d7e4d] to-[#ce1126] shadow-2xl sticky top-0 z-50 border-b-4 border-[#d4af37]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-[#d4af37] to-[#ce1126] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
              <span className="text-[#0d7e4d] font-black text-lg">🇪🇹</span>
            </div>
            <div>
              <span className="font-black text-2xl text-white drop-shadow-lg">QalNet</span>
              <p className="text-xs text-white/80 font-semibold -mt-1">Ethiopia's Digital Equb</p>
            </div>
          </Link>

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
            {/* Language Selector */}
            <select
              value={lang}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="px-4 py-2 border-2 border-[#d4af37] rounded-full text-sm bg-white text-[#0d7e4d] font-bold cursor-pointer"
            >
              {(Object.keys(languages) as Language[]).map((l) => (
                <option key={l} value={l}>
                  {languages[l]}
                </option>
              ))}
            </select>

            {/* Sign Up Button */}
            {!isAuthenticated && (
              <button
                onClick={onSignUpClick}
                className="hidden sm:inline-block px-6 py-2 bg-white text-[#0d7e4d] font-bold rounded-full hover:shadow-lg transition-all text-sm"
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
            {!isAuthenticated && (
              <button
                onClick={() => {
                  onSignUpClick?.();
                  setMobileMenuOpen(false);
                }}
                className="w-full px-4 py-3 bg-white text-[#0d7e4d] font-bold rounded-lg"
              >
                ✍️ Sign Up
              </button>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
