'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Language, defaultLanguage } from '@/i18n/config';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import AuthModal from './components/modals/AuthModal';
import EqubTiersSection from './components/EqubTiersSection';
import { homePathForStoredUser } from './lib/roleHome';

export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated } = useAuth();

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
    <main className="home-bg flex min-h-screen flex-col">
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

      <div className="flex-grow">
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl text-center">
            <h1 className="mb-4 text-3xl font-black text-blue-800 drop-shadow-lg sm:text-5xl md:text-6xl">
              {lang === 'en' ? 'Welcome to QalNet' : lang === 'am' ? 'ወደ QalNet ደህና መጡ' : 'Gara QalNet'}
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-lg text-blue-600 drop-shadow-md sm:text-xl md:text-2xl">
              {lang === 'en'
                ? 'Ethiopia\'s trusted digital Equb platform. Secure, transparent, and built for communities.'
                : lang === 'am'
                ? 'የኢትዮጵያ ታማኝ ዲጂታል Equb መድረክ።'
                : 'Tuulee digaalaa Equb biiroo Itoophiyaatiin.'}
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="rounded-full bg-blue-600 px-10 py-4 text-lg font-black text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-xl"
            >
              Get Started
            </button>
          </div>
        </section>

        <EqubTiersSection
          onJoinStart={() => setShowAuthModal(true)}
          isAuthenticated={isAuthenticated}
        />

        <section className="bg-white/30 px-4 py-16 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-3xl font-black text-blue-800 drop-shadow-lg sm:text-4xl">Ready to Join?</h2>
            <button
              onClick={() => setShowAuthModal(true)}
              className="rounded-full bg-blue-600 px-10 py-4 text-lg font-black text-white shadow-lg transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-xl"
            >
              Sign Up
            </button>
          </div>
        </section>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
