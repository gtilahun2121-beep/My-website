'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import Header from '../components/Header';
import Footer from '../components/Footer';

function ArchitectureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Language>((searchParams?.get('lang') as Language) || defaultLanguage);
  const t = translations[lang];

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    router.push(`/architecture?lang=${newLang}`);
  };

  return (
    <>
      <Header lang={lang} onLanguageChange={handleLanguageChange} />

      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8">
            {t.architecture}
          </h1>

          <div className="prose prose-lg max-w-none">
            <h2 className="text-2xl font-bold mt-8 mb-4">Technology Stack</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-bold mb-2">{t.framework}</h3>
                <p className="text-gray-600">Next.js 14 with App Router - Server-side rendering for marketing, SPA for dashboards</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-bold mb-2">{t.mobile}</h3>
                <p className="text-gray-600">React Native - Native iOS/Android with shared backend logic</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-bold mb-2">{t.animation}</h3>
                <p className="text-gray-600">HTML5 Canvas + SVG - Client-side lottery rendering &lt;100ms</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-bold mb-2">{t.persistence}</h3>
                <p className="text-gray-600">SQLite / WatermelonDB - Offline-first data persistence</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-bold mb-2">{t.realtime}</h3>
                <p className="text-gray-600">Server-Sent Events - Live badge counters without WebSocket overhead</p>
              </div>
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-bold mb-2">{t.styling}</h3>
                <p className="text-gray-600">Tailwind CSS - Dynamic layout for 30-35% text expansion</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mt-8 mb-4">Infrastructure</h2>
            <ul className="space-y-2 mb-8">
              <li className="flex items-start"><span className="text-emerald-600 mr-2">✓</span> Cloudflare WAF & Kong API Gateway</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">✓</span> Neon Serverless Postgres with database branching</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">✓</span> HashiCorp Vault for secret management</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">✓</span> Kubernetes / AWS ECS for deployment</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4">{t.security}</h2>
            <ul className="space-y-2 mb-8">
              <li className="flex items-start"><span className="text-emerald-600 mr-2">🔒</span> AES-256 PII Encryption</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">🔒</span> Row-Level Security (RLS)</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">🔒</span> 5 failed attempt lockout</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">🔒</span> 100 req/min rate limiting</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">🔒</span> 90-day key rotation</li>
            </ul>

            <h2 className="text-2xl font-bold mt-8 mb-4">{t.localizationTitle}</h2>
            <ul className="space-y-2">
              <li className="flex items-start"><span className="text-emerald-600 mr-2">✓</span> Amharic (አማርኛ)</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">✓</span> Afaan Oromo</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">✓</span> Tigrinya (ትግርኛ)</li>
              <li className="flex items-start"><span className="text-emerald-600 mr-2">✓</span> English</li>
            </ul>
          </div>
        </div>
      </section>

      <Footer lang={lang} />
    </>
  );
}

export default function ArchitecturePage() {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <ArchitectureContent />
      </Suspense>
    </main>
  );
}
