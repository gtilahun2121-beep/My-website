'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
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

  const handleAuthSuccess = (title: string, message: string, duration?: number) => {
    setShowAuthModal(false);
    // Add a small delay to ensure modal closes before redirect
    setTimeout(() => {
      // Role-based redirect: admins land on the admin console,
      // members land on the member dashboard.
      router.push(homePathForStoredUser());
    }, 500);
  };

  const handleAuthError = (title: string, message: string, duration?: number) => {
    // Error is already shown to user via toast, just keep modal open
  };

  return (
    <main className="home-bg flex flex-col min-h-screen">
      <Header
        lang={lang}
        onLanguageChange={handleLanguageChange}
        onSignUpClick={() => setShowAuthModal(true)}
        isAuthenticated={false}
      />

      {/* Auth Modal - New Choice Flow */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="choice"
        lang={lang}
        onSuccess={handleAuthSuccess}
        onError={handleAuthError}
      />

      {/* Homepage Content */}
      <div className="flex-grow">
        {/* Hero Section - image shows clearly behind */}
        <section className="text-[#00d9ff] py-16 sm:py-20 px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black mb-4 drop-shadow-lg">
              {lang === 'en' ? 'Welcome to QalNet' : lang === 'am' ? 'ወደ QalNet ደህና መጡ' : 'Gara QalNet'}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-[#00d9ff] mb-8 max-w-3xl mx-auto drop-shadow-md">
              {lang === 'en'
                ? 'Ethiopia\'s trusted digital Equb platform. Secure, transparent, and built for communities.'
                : lang === 'am'
                ? 'የኢትዮጵያ ታማኝ ዲጂታል Equb መድረክ።'
                : 'Tuulee digaalaa Equb biiroo Itoophiyaatiin.'}
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] px-10 py-4 font-black text-lg rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
            >
              Get Started
            </button>
          </div>
        </section>

        {/* Equb Tiers Section - Now positioned below hero */}
        <EqubTiersSection 
          onJoinStart={() => setShowAuthModal(true)}
          isAuthenticated={isAuthenticated}
        />

        {/* CTA Section - semi-transparent color so the image stays visible */}
        <section className="bg-gradient-to-r from-[#001f3f]/55 to-[#001f3f]/45 text-[#00d9ff] py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-black mb-6 drop-shadow-lg">Ready to Join?</h2>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] px-10 py-4 font-black text-lg rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all"
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
