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
        <p className="text-lg font-bold">{lang === 'en' ? 'Please log in' : 'áŒá‰£'}</p>
      </main>
    );
  }

  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header lang={lang} onLanguageChange={setLang} isAuthenticated={true} />

      <div className="flex-grow py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-black text-[#00d9ff] mb-2">
            {lang === 'en' ? 'My Equbs' : 'áˆµáˆŒá‹Ž Equbs'}
          </h1>
          <p className="text-gray-600 mb-8">
            {lang === 'en' ? 'Manage your Equb groups and track contributions' : 'Equb á‰¡á‹µáŠ•á‹ŽáŠ• á‹«áˆµá‰°á‹³á‹µáˆ©'}
          </p>

          {loading ? (
            <p className="text-gray-500">{lang === 'en' ? 'Loading...' : 'á‰ áˆ˜áŒ«áŠ• áˆ‹á‹­...'}</p>
          ) : error ? (
            <div className="bg-brand-50 border border-brand-300 text-brand-700 rounded-lg p-6">
              <p className="font-bold mb-2">{lang === 'en' ? 'Something went wrong' : 'áˆµáˆ…á‰°á‰µ á‰°áŠ¨áˆµá‰·áˆ'}</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : equbs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-6 sm:p-12 text-center">
              <p className="text-5xl mb-4"></p>
              <h3 className="text-xl font-bold text-[#00d9ff] mb-2">
                {lang === 'en' ? 'No Equbs yet' : 'áŠ¥áˆµáŠ«áˆáŠ• áŠ¥á‰á‰¥ á‹¨áˆˆáˆ'}
              </h3>
              <p className="text-gray-600 mb-6">
                {lang === 'en' ? 'Join or create your first Equb group to start saving.' : 'áˆ˜á‰†áŒ á‰¥ áˆˆáˆ˜áŒ€áˆ˜áˆ­ á‹¨áˆ˜áŒ€áˆ˜áˆªá‹« áŠ¥á‰á‰¥á‹ŽáŠ• á‹­á‰€áˆ‹á‰€áˆ‰ á‹ˆá‹­áˆ á‹­ááŒ áˆ©á¢'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/join-equb"
                  className="px-6 py-3 bg-[#001f3f] text-[#00d9ff] font-bold rounded-lg hover:bg-[#001f3f] hover:text-[#00d9ff] transition-all"
                >
                  {lang === 'en' ? 'Join an Equb' : 'áŠ¥á‰á‰¥ á‹­á‰€áˆ‹á‰€áˆ‰'}
                </Link>
                <Link
                  href="/create-equb"
                  className="px-6 py-3 bg-gray-200 text-[#00d9ff] font-bold rounded-lg hover:bg-gray-300 transition-all"
                >
                  {isAdmin ? (lang === 'en' ? 'Create an Equb' : 'áŠ¥á‰á‰¥ á‹­ááŒ áˆ©') : (lang === 'en' ? 'Request an Equb' : 'áŠ¥á‰á‰¥ á‹­áŒ á‹­á‰')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {equbs.map((equb) => (
                <div
                  key={equb.id}
                  className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all cursor-pointer border-l-4 border-[#001f3f]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-[#00d9ff]">{equb.name}</h3>
                    <div className="flex gap-2">
                      {equb.is_host && (
                        <span className="px-2 py-1 bg-[#001f3f]/20 text-[#00d9ff] text-xs font-bold rounded-full">
                          {lang === 'en' ? 'Host' : 'áŠ á‹˜áŒ‹áŒ…'}
                        </span>
                      )}
                      {equb.membership_status === 'pending' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
                          {lang === 'en' ? 'Pending approval' : 'áŒ¸á‹µá‰† á‰ áˆ˜áŒ á‰ á‰… áˆ‹á‹­'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Members' : 'áŠ á‰£áˆŽá‰½'}</span>
                      <span className="font-bold text-[#00d9ff]">{equb.member_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Contribution' : 'áˆ˜á‹‹áŒ®'}</span>
                      <span className="font-bold text-brand-600">
                        ETB {fmt(equb.contribution_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Round' : 'á‹™áˆ­'}</span>
                      <span className="font-bold text-[#00d9ff]">
                        {equb.current_round}/{equb.total_rounds}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Cycle' : 'á‹‘á‹°á‰µ'}</span>
                      <span className="font-bold text-[#00d9ff]">
                        {equb.cycle_days} {lang === 'en' ? 'days' : 'á‰€áŠ“á‰µ'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Status' : 'áˆáŠ”á‰³'}</span>
                      <span className={`font-bold ${equb.status === 'open' || equb.status === 'active' ? 'text-brand-600' : 'text-gray-400'}`}>
                        {equb.status}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/equbs/${equb.id}`}
                    className="block text-center w-full bg-[#001f3f] text-[#00d9ff] font-bold py-2 rounded-lg hover:bg-[#001f3f] hover:text-[#00d9ff] transition-all"
                  >
                    {lang === 'en' ? 'View Details' : 'á‹áˆ­á‹áˆ­ á‹­áˆ˜áˆáŠ¨á‰±'}
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
