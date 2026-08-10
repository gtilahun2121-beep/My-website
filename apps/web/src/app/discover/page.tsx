'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';
import type { EqubGroup } from '@qalnet/shared-types';

export default function DiscoverPage() {
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [equbs, setEqubs] = useState<EqubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadEqubs = () => {
    api.equbAPI
      .getAll()
      .then(setEqubs)
      .catch((err) => setError(err.message || 'Failed to load Equbs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuthenticated) loadEqubs();
    else setLoading(false);
  }, [isAuthenticated]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return equbs;
    return equbs.filter((e) =>
      [e.name, e.host_first_name, e.host_last_name, e.description]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [equbs, search]);

  const handleJoin = async (equbId: string) => {
    setJoiningId(equbId);
    setNotice(null);
    try {
      const result = await api.equbAPI.join(equbId);
      if (result?.pending) {
        setPendingIds((prev) => [...prev, equbId]);
        setNotice({ type: 'success', text: 'Join request submitted — awaiting admin approval.' });
      } else {
        setNotice({ type: 'success', text: 'Successfully joined the Equb!' });
      }
      loadEqubs();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to join Equb.' });
    } finally {
      setJoiningId(null);
    }
  };

  const t = translations[lang];

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col">
        <Header lang={lang} onLanguageChange={setLang} />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800 mb-4">
              {lang === 'en' ? 'Please log in to browse Equbs' : 'እቁቦችን ለማየት ይግቡ'}
            </p>
            <Link href="/" className="text-blue-600 hover:underline">
              {lang === 'en' ? 'Go to Home' : 'ወደ ቤት ሂድ'}
            </Link>
          </div>
        </div>
        <Footer lang={lang} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header lang={lang} onLanguageChange={setLang} isAuthenticated={true} />

      <div className="flex-grow py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            {lang === 'en' ? 'Discover Equbs 🔎' : 'እቁቦችን ያግኙ 🔎'}
          </h1>
          <p className="text-gray-600 mb-8">
            {lang === 'en'
              ? 'Browse open Equb circles and join the one that fits your savings goals'
              : 'ክፍት የእቁብ ክበቦችን ይመልከቱ እና የሚስማማዎትን ይቀላቀሉ'}
          </p>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={lang === 'en' ? 'Search Equbs...' : 'ፈልግ...'}
                className="border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:border-[#0d7e4d]"
              />
              <select
                value=""
                onChange={(e) => setSearch(e.target.value === '' ? '' : search)}
                className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none"
                disabled
              >
                <option>{lang === 'en' ? 'All Categories' : 'ሁሉም'}</option>
              </select>
              <p className="text-sm text-gray-500 flex items-center">
                {filtered.length} {lang === 'en' ? 'Equbs found' : 'እቁቦች ተገኝተዋል'}
              </p>
            </div>
          </div>

          {notice && (
            <div className={`border rounded-lg p-4 mb-6 ${notice.type === 'success' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {notice.text}
            </div>
          )}

          {loading ? (
            <p className="text-gray-500">{lang === 'en' ? 'Loading...' : 'በመጫን ላይ...'}</p>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">
              <p className="font-bold mb-2">{lang === 'en' ? 'Something went wrong' : 'ስህተት ተከስቷል'}</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-5xl mb-4">🔎</p>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {lang === 'en' ? 'No Equbs found' : 'ምንም እቁብ አልተገኘም'}
              </h3>
              <p className="text-gray-600 mb-6">
                {lang === 'en'
                  ? 'Check back later or request an Equb from the admin.'
                  : 'በኋላ ይሞክሩ ወይም እቁብ እንዲፈጠር ከአስተዳዳሪ ይጠይቁ።'}
              </p>
              <Link
                href="/create-equb"
                className="inline-block px-6 py-3 bg-[#0d7e4d] text-white font-bold rounded-lg hover:bg-[#0a5c38] transition-all"
              >
                {lang === 'en' ? 'Request an Equb' : 'እቁብ ይጠይቁ'}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((equb) => (
                <div
                  key={equb.id}
                  className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all border-l-4 border-[#0d7e4d] flex flex-col"
                >
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{equb.name || 'Unnamed Equb'}</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {lang === 'en' ? 'Host' : 'አዘጋጅ'}: {equb.host_first_name} {equb.host_last_name}
                  </p>
                  {equb.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{equb.description}</p>
                  )}
                  <div className="space-y-2 text-sm mb-4 flex-grow">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Members' : 'አባሎች'}</span>
                      <span className="font-bold">{equb.member_count ?? 0} / {equb.total_rounds}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Contribution' : 'መዋጮ'}</span>
                      <span className="font-bold text-[#0d7e4d]">
                        ETB {Number(equb.contribution_amount).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Cycle' : 'ዑደት'}</span>
                      <span className="font-bold">{equb.cycle_days} {lang === 'en' ? 'days' : 'ቀናት'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Open Slots' : 'ክፍት ቦታ'}</span>
                      <span className={`font-bold ${equb.open_slots === 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {equb.open_slots}
                      </span>
                    </div>
                  </div>
                  <button
                    disabled={equb.open_slots === 0 || joiningId === equb.id || pendingIds.includes(equb.id)}
                    onClick={() => handleJoin(equb.id)}
                    className={`w-full font-bold py-2 rounded-lg transition-all ${
                      equb.open_slots === 0 || pendingIds.includes(equb.id)
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-[#0d7e4d] text-white hover:bg-[#0a5c38]'
                    }`}
                  >
                    {joiningId === equb.id
                      ? (lang === 'en' ? 'Submitting...' : 'በመላክ ላይ...')
                      : pendingIds.includes(equb.id)
                        ? (lang === 'en' ? '⏳ Awaiting Approval' : '⏳ ጸድቆ በመጠበቅ ላይ')
                        : equb.open_slots === 0
                          ? (lang === 'en' ? 'Full' : 'ሙሉ')
                          : (lang === 'en' ? 'Request to Join' : 'መቀላቀል ጠይቅ')}
                  </button>
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
