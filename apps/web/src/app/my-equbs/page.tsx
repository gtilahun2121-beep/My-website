'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';
import type { EqubGroup } from '@qalnet/shared-types';

export default function MyEqubsPage() {
  const { isAuthenticated, user } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [equbs, setEqubs] = useState<EqubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAuthenticated) {
      api.equbAPI
        .getMine()
        .then(setEqubs)
        .catch((err) => setError(err.message || 'Failed to load your Equbs'))
        .finally(() => setLoading(false));
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-bold">{lang === 'en' ? 'Please log in' : 'ግባ'}</p>
      </main>
    );
  }

  const fmt = (n: number) => n.toLocaleString('en-US');

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

          {loading ? (
            <p className="text-gray-500">{lang === 'en' ? 'Loading...' : 'በመጫን ላይ...'}</p>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">
              <p className="font-bold mb-2">{lang === 'en' ? 'Something went wrong' : 'ስህተት ተከስቷል'}</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : equbs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-5xl mb-4">👥</p>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {lang === 'en' ? 'No Equbs yet' : 'እስካሁን እቁብ የለም'}
              </h3>
              <p className="text-gray-600 mb-6">
                {lang === 'en' ? 'Join or create your first Equb group to start saving.' : 'መቆጠብ ለመጀመር የመጀመሪያ እቁብዎን ይቀላቀሉ ወይም ይፍጠሩ።'}
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/join-equb"
                  className="px-6 py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all"
                >
                  {lang === 'en' ? 'Join an Equb' : 'እቁብ ይቀላቀሉ'}
                </Link>
                <Link
                  href="/create-equb"
                  className="px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition-all"
                >
                  {isAdmin ? (lang === 'en' ? 'Create an Equb' : 'እቁብ ይፍጠሩ') : (lang === 'en' ? 'Request an Equb' : 'እቁብ ይጠይቁ')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {equbs.map((equb) => (
                <div
                  key={equb.id}
                  className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all cursor-pointer border-l-4 border-[#0d7e4d]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{equb.name}</h3>
                    <div className="flex gap-2">
                      {equb.is_host && (
                        <span className="px-2 py-1 bg-[#d4af37]/20 text-[#8a6d1d] text-xs font-bold rounded-full">
                          {lang === 'en' ? 'Host' : 'አዘጋጅ'}
                        </span>
                      )}
                      {equb.membership_status === 'pending' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
                          {lang === 'en' ? '⏳ Pending approval' : '⏳ ጸድቆ በመጠበቅ ላይ'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Members' : 'አባሎች'}</span>
                      <span className="font-bold text-gray-900">{equb.member_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Contribution' : 'መዋጮ'}</span>
                      <span className="font-bold text-green-600">
                        ETB {fmt(equb.contribution_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Round' : 'ዙር'}</span>
                      <span className="font-bold text-gray-900">
                        {equb.current_round}/{equb.total_rounds}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Cycle' : 'ዑደት'}</span>
                      <span className="font-bold text-gray-900">
                        {equb.cycle_days} {lang === 'en' ? 'days' : 'ቀናት'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Status' : 'ሁኔታ'}</span>
                      <span className={`font-bold ${equb.status === 'open' || equb.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                        {equb.status}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/equbs/${equb.id}`}
                    className="block text-center w-full bg-[#0d7e4d] text-white font-bold py-2 rounded-lg hover:bg-[#0a5c38] transition-all"
                  >
                    {lang === 'en' ? 'View Details' : 'ዝርዝር ይመልከቱ'}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
