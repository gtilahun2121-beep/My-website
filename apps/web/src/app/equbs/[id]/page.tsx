'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';
import type { EqubGroup } from '@qalnet/shared-types';

export default function EqubDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [equb, setEqub] = useState<EqubGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const t = translations[lang];

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    api.equbAPI
      .getById(params.id)
      .then((data) => {
        if (!cancelled) {
          setEqub(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load Equb');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, isAuthenticated]);

  const handleJoin = async () => {
    setJoining(true);
    setNotice(null);
    try {
      const result = await api.equbAPI.join(params.id);
      if (result?.pending) {
        setNotice('Join request submitted — awaiting admin approval.');
      } else {
        setNotice('Successfully joined the Equb!');
      }
      const fresh = await api.equbAPI.getById(params.id);
      setEqub(fresh);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to join Equb.');
    } finally {
      setJoining(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col">
        <Header lang={lang} onLanguageChange={setLang} />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800 mb-4">
              {lang === 'en' ? 'Please log in' : 'ይግቡ'}
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
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => router.back()}
            className="text-sm text-[#0d7e4d] font-bold hover:underline mb-6"
          >
            ← {lang === 'en' ? 'Back' : 'ተመለስ'}
          </button>

          {loading ? (
            <p className="text-gray-500">{lang === 'en' ? 'Loading...' : 'በመጫን ላይ...'}</p>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-6">
              <p className="font-bold mb-2">{lang === 'en' ? 'Something went wrong' : 'ስህተት ተከስቷል'}</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : equb ? (
            <>
              <div className="bg-white rounded-xl shadow-md p-8 mb-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div>
                    <h1 className="text-3xl font-black text-gray-900 mb-1">{equb.name}</h1>
                    <p className="text-sm text-gray-500">
                      {lang === 'en' ? 'Hosted by' : 'አዘጋጅ'}: {equb.host_first_name} {equb.host_last_name}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      equb.status === 'open'
                        ? 'bg-green-100 text-green-700'
                        : equb.status === 'active'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {equb.status}
                  </span>
                </div>

                {equb.description && (
                  <p className="text-gray-700 mb-6">{equb.description}</p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                      {lang === 'en' ? 'Contribution' : 'መዋጮ'}
                    </p>
                    <p className="text-xl font-black text-[#0d7e4d]">
                      ETB {Number(equb.contribution_amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                      {lang === 'en' ? 'Total Pot' : 'ጠቅላላ ማሰባሰብያ'}
                    </p>
                    <p className="text-xl font-black text-gray-900">
                      ETB {Number(equb.total_amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                      {lang === 'en' ? 'Members' : 'አባላት'}
                    </p>
                    <p className="text-xl font-black text-gray-900">
                      {equb.member_count} / {equb.total_rounds}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                      {lang === 'en' ? 'Round' : 'ዙር'}
                    </p>
                    <p className="text-xl font-black text-gray-900">
                      {equb.current_round} / {equb.total_rounds}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                      {lang === 'en' ? 'Cycle' : 'ዑደት'}
                    </p>
                    <p className="text-xl font-black text-gray-900">
                      {equb.cycle_days} {lang === 'en' ? 'days' : 'ቀናት'}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                      {lang === 'en' ? 'Open Slots' : 'ክፍት ቦታ'}
                    </p>
                    <p className="text-xl font-black text-gray-900">{equb.open_slots}</p>
                  </div>
                </div>

                {notice && (
                  <div className={`border rounded-lg p-4 mb-4 ${notice.startsWith('Failed') || notice.startsWith('You are already') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-300 text-green-800'}`}>
                    {notice}
                  </div>
                )}

                {(() => {
                  const membership = equb.membership_status;
                  const isFull = equb.open_slots === 0;
                  const isPending = membership === 'pending';
                  const isMember = membership === 'approved';
                  const isHost = equb.is_host;

                  let label = lang === 'en' ? 'Request to Join' : 'መቀላቀል ጠይቅ';
                  const disabled = isFull || isPending || isMember || joining;
                  if (isHost) label = lang === 'en' ? 'You host this Equb' : 'ይህን እቁብ ያስተናግዳሉ';
                  else if (isMember) label = lang === 'en' ? '✅ You are a member' : '✅ አባል ነዎት';
                  else if (isPending) label = lang === 'en' ? '⏳ Awaiting admin approval' : '⏳ የአስተዳዳሪ ማጽደቅ በመጠበቅ ላይ';
                  else if (isFull) label = lang === 'en' ? 'Equb is Full' : 'እቁቡ ሞልቷል';

                  return (
                    <button
                      onClick={handleJoin}
                      disabled={disabled}
                      className={`w-full py-3 font-black rounded-lg transition-all ${
                        disabled
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                          : 'bg-[#0d7e4d] text-white hover:bg-[#0a5c38]'
                      }`}
                    >
                      {joining ? (lang === 'en' ? 'Submitting...' : 'በመላክ ላይ...') : label}
                    </button>
                  );
                })()}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
