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
    <main className="flex min-h-screen flex-col bg-white">
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
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-blue-50 to-white px-4 py-12 sm:py-16 md:py-20">
          {/* Background Elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-blue-200 opacity-20 blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-100 opacity-20 blur-3xl"></div>
          </div>

          <div className="relative z-10 mx-auto max-w-7xl">
            <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
              {/* Left Content */}
              <div className="space-y-6">
                {/* Tagline */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    👥
                  </div>
                  <span className="text-sm font-semibold text-blue-600">
                    {lang === 'en' ? 'Together for a Brighter Future' : 'አንድ ላይ ለበለጠ ወደፊት'}
                  </span>
                </div>

                {/* Main Heading */}
                <div>
                  <h1 className="text-4xl font-black leading-tight text-blue-900 sm:text-5xl md:text-6xl">
                    {lang === 'en' 
                      ? "QalNet Ethiopia's Digital Equb" 
                      : "QalNet የኢትዮጵያ ዲጂታል ኢኩብ"}
                  </h1>
                </div>

                {/* Subheading */}
                <p className="max-w-md text-base text-gray-600 sm:text-lg">
                  {lang === 'en'
                    ? 'Secure, transparent, and built for communities. Digital savings, stronger together.'
                    : 'ደህንነታዊ፣ ግልጽ፣ እና ለማህበረሰብ የተገነባ። ዲጂታል ቁጠባ፣ አንድ ላይ ጠንካራ።'}
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3 font-bold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
                  >
                    <span>👤</span>
                    <span>{lang === 'en' ? 'Get Started' : 'ጀምር'}</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Right Content - Community Circle Image */}
              <div className="relative flex justify-center items-center">
                <div className="relative w-full max-w-md aspect-square">
                  {/* This is where the community circle image would go */}
                  {/* For now, we'll create a placeholder with a gradient circle */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center shadow-2xl">
                    {/* Community illustration placeholder */}
                    <div className="text-center space-y-4">
                      <div className="text-6xl">👥</div>
                      <p className="text-blue-600 font-semibold">
                        {lang === 'en' ? 'Join our community' : 'ወደ ማህበረሰባችን присоединяйтесь'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {/* Feature 1 */}
              <div className="space-y-3 text-center md:text-left">
                <div className="text-3xl">🔒</div>
                <h3 className="text-lg font-bold text-blue-900">
                  {lang === 'en' ? 'Secure' : 'ደህንነታዊ'}
                </h3>
                <p className="text-gray-600">
                  {lang === 'en' 
                    ? 'End-to-end encrypted transactions and secure storage'
                    : 'ሙሉ-ስሪት ምስጠራ እና ደህንነታዊ ማከማቻ'}
                </p>
              </div>

              {/* Feature 2 */}
              <div className="space-y-3 text-center md:text-left">
                <div className="text-3xl">👁️</div>
                <h3 className="text-lg font-bold text-blue-900">
                  {lang === 'en' ? 'Transparent' : 'ግልጽ'}
                </h3>
                <p className="text-gray-600">
                  {lang === 'en'
                    ? 'Real-time tracking of all transactions and payouts'
                    : 'ሁሉም ግብይቶች እና ክፍያዎች በሪየል ታይም ትከታ'}
                </p>
              </div>

              {/* Feature 3 */}
              <div className="space-y-3 text-center md:text-left">
                <div className="text-3xl">🤝</div>
                <h3 className="text-lg font-bold text-blue-900">
                  {lang === 'en' ? 'Community' : 'ማህበረሰብ'}
                </h3>
                <p className="text-gray-600">
                  {lang === 'en'
                    ? 'Built for communities, by communities'
                    : 'ለማህበረሰብ የተገነባ፣ ማህበረሰብ ይገነባዋል'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Equb Tiers Section */}
        <EqubTiersSection
          onJoinStart={() => setShowAuthModal(true)}
          isAuthenticated={isAuthenticated}
        />

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-4 text-3xl font-black text-white sm:text-4xl">
              {lang === 'en' ? 'Ready to Join?' : 'ለመቀላቀል ዝግጁ ነዎት?'}
            </h2>
            <p className="mb-8 text-lg text-blue-100">
              {lang === 'en'
                ? 'Start your digital savings journey today'
                : 'ዛሬ ሞመ የዲጂታል ቁጠባ ጉዞ ጀምር'}
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="rounded-full bg-white px-10 py-4 text-lg font-black text-blue-600 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              {lang === 'en' ? 'Sign Up Now' : 'አሁን ይመዝገቡ'}
            </button>
          </div>
        </section>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
