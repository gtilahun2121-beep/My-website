'use client';

import { useState } from 'react';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export default function MyEqubsPage() {
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-bold">{lang === 'en' ? 'Please log in' : 'ግባ'}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header lang={lang} onLanguageChange={setLang} isAuthenticated={true} />

      <div className="flex-grow py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            {lang === 'en' ? 'My Equbs 👥' : 'ስሌዎ Equbs 👥'}
          </h1>
          <p className="text-gray-600 mb-8">
            {lang === 'en' ? 'Manage your Equb groups and track contributions' : 'Equb ቡድንዎን ያስተዳድሩ'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Equb Cards */}
            {[
              { name: 'Gold Equb', members: 12, contributed: 'ETB 15,000', nextDue: '2024-02-15' },
              { name: 'Community Fund', members: 8, contributed: 'ETB 8,000', nextDue: '2024-02-20' },
              { name: 'Business Support', members: 15, contributed: 'ETB 20,000', nextDue: '2024-02-25' },
            ].map((equb, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all cursor-pointer border-l-4 border-[#0d7e4d]"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-4">{equb.name}</h3>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{lang === 'en' ? 'Members' : 'አባሎች'}</span>
                    <span className="font-bold text-gray-900">{equb.members}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{lang === 'en' ? 'Contributed' : 'ተጠምዱ'}</span>
                    <span className="font-bold text-green-600">{equb.contributed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{lang === 'en' ? 'Next Payment' : 'ቀጣይ ክፍያ'}</span>
                    <span className="font-bold text-gray-900">{equb.nextDue}</span>
                  </div>
                </div>
                <button className="w-full bg-[#0d7e4d] text-white font-bold py-2 rounded-lg hover:bg-[#0a5c38] transition-all">
                  {lang === 'en' ? 'View Details' : 'ዝርዝር ይመልከቱ'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
