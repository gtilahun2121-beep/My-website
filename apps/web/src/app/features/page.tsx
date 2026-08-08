'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import Header from '../components/Header';
import Footer from '../components/Footer';

function FeaturesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Language>((searchParams?.get('lang') as Language) || defaultLanguage);
  const t = translations[lang];

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    router.push(`/features?lang=${newLang}`);
  };

  const navTabs = [
    {
      id: 'my-equbs',
      icon: '👥',
      title: t.myEqubs,
      features: [
        'Active pool dashboard',
        'Unpaid round tracking',
        'Member listings',
        'Auto-debit status',
        'Historical performance',
        'Real-time notifications'
      ]
    },
    {
      id: 'discover',
      icon: '🔍',
      title: t.discover,
      features: [
        'Browse open groups',
        'Dynamic filtering',
        'Host reputation ratings',
        'Real-time progress bars',
        'Join functionality',
        'Quick apply'
      ]
    },
    {
      id: 'calendar',
      icon: '📅',
      title: t.calendar,
      features: [
        'Payment deadlines',
        'Grace periods',
        'Scheduled draws',
        'Ethiopian calendar',
        'Timezone support',
        'Calendar sync'
      ]
    },
    {
      id: 'wallet',
      icon: '💳',
      title: t.wallet,
      features: [
        'Local digital wallet',
        'Bank token management',
        'QR authorization',
        'Transaction history',
        'Real-time balance',
        'Multiple currencies'
      ]
    },
    {
      id: 'more',
      icon: '⋯',
      title: t.more,
      features: [
        'Support ticketing',
        'FAQ database',
        'USSD *808# portal',
        'Privacy docs',
        'App settings',
        'Account management'
      ]
    }
  ];

  const uxPrinciples = [
    {
      title: t.cognitiveDescent,
      icon: '🧠',
      desc: 'Three-pillar navigation with emerald action indicators'
    },
    {
      title: t.visualHierarchy,
      icon: '📐',
      desc: 'Active rounds pinned to top, progressive disclosure'
    },
    {
      title: t.inAppLearning,
      icon: '📚',
      desc: 'Video tutorials, interactive docs, contextual tooltips'
    }
  ];

  const offlineFeatures = [
    'SQLite / WatermelonDB offline store',
    'USSD *808# feature phone support',
    'SMS fallback notifications',
    'Background sync queues',
    'Automatic reconnection',
    'Conflict resolution'
  ];

  return (
    <>
      <Header lang={lang} onLanguageChange={handleLanguageChange} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-50 to-teal-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {t.features}
          </h1>
          <p className="text-xl text-gray-600">
            Comprehensive feature set designed for Ethiopian market
          </p>
        </div>
      </section>

      {/* Navigation Tabs */}
      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-900">
            {t.uxTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {navTabs.map((tab) => (
              <div key={tab.id} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-8 border border-gray-200 hover:border-emerald-400 transition-colors">
                <div className="text-4xl mb-4">{tab.icon}</div>
                <h3 className="font-bold text-lg mb-4 text-gray-900">{tab.title}</h3>
                <ul className="space-y-2">
                  {tab.features.map((feature, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start">
                      <span className="text-emerald-500 mr-2">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UX Principles */}
      <section className="py-20 md:py-32 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-900">
            {t.uxTitle}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {uxPrinciples.map((principle, idx) => (
              <div key={idx} className="bg-white rounded-lg p-8 shadow-sm hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{principle.icon}</div>
                <h3 className="font-bold text-xl mb-2 text-gray-900">{principle.title}</h3>
                <p className="text-gray-600">{principle.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Offline Support */}
      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-gray-900">
                {t.offlineTitle}
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Fully functional without connectivity, seamless sync on reconnect
              </p>
              <ul className="space-y-4">
                {offlineFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-emerald-600 font-bold mr-3">✓</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4">📱</div>
                <p className="text-gray-700 font-semibold">Offline-First Architecture</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer lang={lang} />
    </>
  );
}

export default function FeaturesPage() {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <FeaturesContent />
      </Suspense>
    </main>
  );
}
