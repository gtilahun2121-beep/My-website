'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import Header from '../components/Header';
import Footer from '../components/Footer';

function SecurityContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Language>((searchParams?.get('lang') as Language) || defaultLanguage);
  const t = translations[lang];

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    router.push(`/security?lang=${newLang}`);
  };

  const securityMeasures = [
    { title: t.piiEncryption, desc: 'AES-256 encryption for sensitive identifiers' },
    { title: t.rls, desc: 'Database-level row-level security enforcement' },
    { title: t.bruteForce, desc: 'Account lockout after 5 failed attempts' },
    { title: t.rateLimiting, desc: '100 requests per minute rate limiting' },
    { title: t.ddos, desc: 'Cloudflare WAF DDoS protection' },
  ];

  return (
    <>
      <Header lang={lang} onLanguageChange={handleLanguageChange} />

      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {t.securityTitle}
          </h1>
          <p className="text-xl text-gray-600 mb-16">
            Enterprise-grade security and data protection
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {securityMeasures.map((measure, idx) => (
              <div key={idx} className="bg-gradient-to-br from-red-50 to-pink-50 rounded-lg p-8 border border-red-200">
                <h3 className="font-bold text-lg mb-2 text-gray-900">🔒 {measure.title}</h3>
                <p className="text-gray-600">{measure.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-8 border border-red-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Data Protection</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <span className="text-red-600 mr-3 font-bold">✓</span>
                <span className="text-gray-700">PII encrypted at application level with pgcrypto</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-3 font-bold">✓</span>
                <span className="text-gray-700">Row-level security enforced at database policy level</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-3 font-bold">✓</span>
                <span className="text-gray-700">Automated 90-day API key rotation</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-3 font-bold">✓</span>
                <span className="text-gray-700">HashiCorp Vault secret management</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-600 mr-3 font-bold">✓</span>
                <span className="text-gray-700">Compliance with NBE Directive No. ONPS/10/2025</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <Footer lang={lang} />
    </>
  );
}

export default function SecurityPage() {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <SecurityContent />
      </Suspense>
    </main>
  );
}
