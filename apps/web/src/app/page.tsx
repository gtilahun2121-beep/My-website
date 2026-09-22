'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Language, defaultLanguage } from '@/i18n/config';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import AuthModal from './components/modals/AuthModal';
import { homePathForStoredUser } from './lib/roleHome';

const heroImage =
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80';

export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [showAuthModal, setShowAuthModal] = useState(false);

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
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(191,219,254,0.9)_28%,_rgba(147,197,253,0.7)_100%)] text-slate-900">
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
        lang={lang}
        onSuccess={handleAuthSuccess}
        onError={() => undefined}
      />

      <section className="relative px-4 pb-4 pt-2 sm:px-6 lg:px-8" style={{ backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1))' }}>
        <div className="mx-auto max-w-[1380px]">
          <div className="relative overflow-hidden px-2 pb-0 pt-0 sm:px-4 lg:px-6">
            <div className="relative grid items-center gap-2 lg:grid-cols-[0.82fr_1.18fr] lg:gap-4">
              <div className="max-w-[560px] pb-2 pt-3 sm:pt-5 lg:pt-6">
                <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-blue-200/90 bg-white/20 px-3 py-2 text-[0.9rem] font-semibold text-[#0d5fcc] shadow-sm backdrop-blur-sm">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-base shadow-md">
                    👥
                  </div>
                  <span>{lang === 'en' ? 'Together for a Brighter Future' : 'አንድ ላይ ለበለጠ ወደፊት'}</span>
                </div>

                <h1 className="text-[2.9rem] font-black leading-[0.9] tracking-[-0.08em] text-[#0d5fcc] sm:text-[3.8rem] md:text-[4.9rem] xl:text-[6.1rem]">
                  <span className="block">QalNet</span>
                  <span className="block">Ethiopia&apos;s</span>
                  <span className="block">Digital Equb</span>
                </h1>

                <p className="mt-4 max-w-[500px] text-[1.05rem] font-medium leading-relaxed text-slate-700 sm:text-[1.35rem]">
                  {lang === 'en'
                    ? 'Secure, transparent, and built for communities. Digital savings, stronger together.'
                    : 'ደህንነታዊ፣ ግልጽ፣ እና ለማህበረሰብ የተገነባ። ዲጂታል ቁጠባ፣ አንድ ላይ ጠንካራ።'}
                </p>

                <div className="pt-5">
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-7 py-4 text-xl font-bold text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_16px_35px_rgba(37,99,235,0.45)]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg">◍</span>
                    <span>{lang === 'en' ? 'Get Started' : 'ጀምር'}</span>
                    <span className="text-2xl leading-none">→</span>
                  </button>
                </div>
              </div>

              <div className="relative flex items-center justify-center lg:justify-end">
                <div className="relative h-[340px] w-full max-w-[820px] sm:h-[430px] lg:h-[540px]">
                  <div className="absolute inset-x-[14%] bottom-[8px] h-28 rounded-full bg-[radial-gradient(circle,_rgba(96,165,250,0.52),_rgba(147,197,253,0.15)_46%,_transparent_80%)] blur-2xl" />
                  <div className="absolute inset-0 rounded-[50%] border border-sky-200/80 opacity-90" />
                  <div className="absolute inset-[8%] rounded-[50%] border border-sky-300/60 opacity-90" />
                  <div className="absolute inset-[18%] rounded-[50%] border border-sky-200/70 opacity-90" />
                  <div className="absolute inset-x-[22%] bottom-[18px] top-[12%] rounded-[50%] border border-sky-200/70" />

                  <div
                    className="absolute inset-x-[12%] bottom-[20px] top-[8%] rounded-[46%] bg-cover bg-center shadow-[0_20px_60px_rgba(59,130,246,0.18)]"
                    style={{
                      backgroundImage: `url(${heroImage})`,
                      backgroundPosition: 'center center',
                      backgroundSize: 'cover',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
