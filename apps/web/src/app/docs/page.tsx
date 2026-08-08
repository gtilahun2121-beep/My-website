'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import Header from '../components/Header';
import Footer from '../components/Footer';

function DocsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Language>((searchParams?.get('lang') as Language) || defaultLanguage);
  const t = translations[lang];

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    router.push(`/docs?lang=${newLang}`);
  };

  const docSections = [
    { title: t.architecture, href: '/architecture', icon: '🏗️' },
    { title: t.security, href: '/security', icon: '🔒' },
    { title: t.accessibility, href: '/accessibility', icon: '♿' },
    { title: t.roadmap, href: '/roadmap', icon: '🗺️' },
  ];

  return (
    <>
      <Header lang={lang} onLanguageChange={handleLanguageChange} />

      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {t.documentation}
          </h1>
          <p className="text-xl text-gray-600 mb-16">
            Complete documentation and technical specifications
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {docSections.map((section, idx) => (
              <Link
                key={idx}
                href={`${section.href}?lang=${lang}`}
                className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-8 border border-gray-200 hover:border-emerald-400 hover:shadow-lg transition-all"
              >
                <div className="text-4xl mb-4">{section.icon}</div>
                <h3 className="font-bold text-lg text-gray-900 hover:text-emerald-600 transition-colors">
                  {section.title}
                </h3>
              </Link>
            ))}
          </div>

          <div className="mt-16 bg-blue-50 border-l-4 border-blue-400 p-6 rounded">
            <h3 className="font-bold text-blue-900 mb-2">API Documentation</h3>
            <p className="text-blue-800">
              Full API contracts and integration guides available in the technical specification document.
              Version 1.0 - Generated in accordance with the QalNet Enterprise System Architecture.
            </p>
          </div>
        </div>
      </section>

      <Footer lang={lang} />
    </>
  );
}

export default function DocsPage() {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <DocsContent />
      </Suspense>
    </main>
  );
}
