'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Language, defaultLanguage } from '@/i18n/config';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import AuthModal from './components/modals/AuthModal';
import { homePathForStoredUser } from './lib/roleHome';

export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  // When the citizen returns from the real Fayda (eSignet) page the callback
  // redirected here with ?fayda=verified — reopen the signup flow immediately.
  const [faydaReturn] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('fayda') === 'verified',
  );
  const [showAuthModal, setShowAuthModal] = useState(faydaReturn);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setTimeout(() => {
      router.push(homePathForStoredUser());
    }, 500);
  };

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-900">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(8, 47, 99, 0.38), rgba(15, 23, 42, 0.18)), url('/image.png')",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.12),transparent_30%)]" />

      <Header
        lang={lang}
        onLanguageChange={handleLanguageChange}
        onSignUpClick={() => setShowAuthModal(true)}
        isAuthenticated={false}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="choice"
        initialChoiceStage={faydaReturn ? 'signup' : 'choice'}
        lang={lang}
        onSuccess={handleAuthSuccess}
        onError={() => undefined}
      />

      <section className="relative z-10 mx-auto max-w-[1520px] px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <div className="relative grid min-h-[760px] items-center gap-8 lg:grid-cols-1">
          <div className="max-w-[650px] pb-6 pt-4 lg:pt-8">
            <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-[#dce9ff] bg-white/35 px-4 py-2 text-[0.95rem] font-semibold text-[#0d5fcc] shadow-[0_12px_26px_rgba(37,99,235,0.08)] backdrop-blur-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0d5fcc] text-base shadow-md">
                <span aria-hidden="true">👥</span>
              </div>
              <span>{lang === 'en' ? 'Together for a Brighter Future' : 'አንድ ላይ ለበለጠ ወደፊት'}</span>
            </div>

            <h1 className="text-[4.2rem] font-black leading-[0.76] tracking-[-0.09em] text-[#0d5fcc] sm:text-[5.1rem] md:text-[6.5rem] xl:text-[7.4rem]">
              <span className="block">QalNet</span>
              <span className="block text-[#0d5fcc]/95">Ethiopia&apos;s</span>
              <span className="block text-[#0d5fcc]/95">Digital Equb</span>
            </h1>

            <p className="mt-7 max-w-[560px] text-[1.18rem] font-medium leading-relaxed text-slate-700 sm:text-[1.5rem]">
              {lang === 'en'
                ? 'Secure, transparent, and built for communities. Digital savings, stronger together.'
                : 'ደህንነታዊ፣ ግልጽ፣ እና ለማህበረሰብ የተገነባ። ዲጂታል ቁጠባ፣ አንድ ላይ ጠንካራ።'}
            </p>

            <div className="mt-8">
              <button
                onClick={() => setShowAuthModal(true)}
                className="inline-flex items-center gap-4 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 text-xl font-bold text-white shadow-[0_16px_30px_rgba(37,99,235,0.38)] transition-all hover:scale-[1.01]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg">N</span>
                <span>{lang === 'en' ? 'Get Started' : 'ጀምር'}</span>
                <span className="text-2xl leading-none">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
