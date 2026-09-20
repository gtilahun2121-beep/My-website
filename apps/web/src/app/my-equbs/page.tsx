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
import { motion } from 'framer-motion';

export default function MyEqubsPage() {
  const { isAuthenticated, user } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [equbs, setEqubs] = useState<EqubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isAuthenticated) {
      // Check for join notice from session storage
      if (typeof window !== 'undefined') {
        const joinNotice = sessionStorage.getItem('qalnet_join_notice');
        if (joinNotice) {
          setNotice(joinNotice);
          sessionStorage.removeItem('qalnet_join_notice');
        }
      }

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
        <p className="text-lg font-bold">{lang === 'en' ? 'Please log in' : 'እባክዎ ግባ'}</p>
      </main>
    );
  }

  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Header lang={lang} onLanguageChange={setLang} isAuthenticated={true} />

      <div className="flex-grow py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Join Success Notice */}
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[#00d9ff]/10 to-[#0066ff]/10 border-l-4 border-[#00d9ff] rounded-lg p-6 mb-8"
            >
              <p className="text-[#00d9ff] font-black text-lg mb-3">{notice}</p>
              <div className="space-y-2 text-sm text-[#00d9ff]">
                <p>✅ {lang === 'en' ? 'Next steps:' : 'ሚቀጥሉ ደረጃዎች:'}</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{lang === 'en' ? 'Wait for admin approval of your membership' : 'የአስተዳዳሪ ማጽደቅ በመጠበቅ ላይ'}</li>
                  <li>{lang === 'en' ? 'Once approved, make your first contribution' : 'ከተጸደቁ በኋላ የመጀመሪያ መዋጮዎን ያድርጉ'}</li>
                  <li>{lang === 'en' ? 'Track your progress on the equb details page' : 'በዝርዝር ገጽ ላይ እድገትዎን ይከታተሉ'}</li>
                </ul>
              </div>
              <button
                onClick={() => setNotice(null)}
                className="mt-4 text-sm text-[#00d9ff] hover:underline font-bold"
              >
                {lang === 'en' ? 'Dismiss' : 'ዝጋ'}
              </button>
            </motion.div>
          )}

          <h1 className="text-3xl sm:text-4xl font-black text-[#00d9ff] mb-2">
            {lang === 'en' ? 'My Equbs' : 'ሙያዬ ኤኩብ'}
          </h1>
          <p className="text-gray-600 mb-8">
            {lang === 'en' ? 'Manage your Equb groups and track contributions' : 'Equb ቡድናትዎን ያስተዳድሩ እና መዋጮ ይከታተሉ'}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-4 border-[#00d9ff]/20 border-t-[#00d9ff] animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-semibold">
                  {lang === 'en' ? 'Loading your equbs...' : 'ኤኩብ በሚጫወት ላይ...'}
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-400 rounded-lg p-6">
              <p className="font-bold text-red-600 mb-2">{lang === 'en' ? 'Something went wrong' : 'ስህተት ተከስቷል'}</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : equbs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-6 sm:p-12 text-center border-t-4 border-[#001f3f]">
              <p className="text-6xl mb-4">🎯</p>
              <h3 className="text-xl font-bold text-[#00d9ff] mb-2">
                {lang === 'en' ? 'No Equbs yet' : 'ገና ኤኩብ የሉም'}
              </h3>
              <p className="text-gray-600 mb-6">
                {lang === 'en' ? 'Join or create your first Equb group to start saving.' : 'መረጃየትን ለመጀመር የመጀመሪያ Equb ቡድን ይዋሃዱ ወይም ይፍጠሩ።'}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/join-equb"
                  className="px-6 py-3 bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] font-bold rounded-lg hover:shadow-lg transition-all"
                >
                  ➕ {lang === 'en' ? 'Join an Equb' : 'ኤኩብ ይዋሃዱ'}
                </Link>
                <Link
                  href="/create-equb"
                  className="px-6 py-3 bg-gray-200 text-[#00d9ff] font-bold rounded-lg hover:bg-gray-300 transition-all"
                >
                  ✨ {isAdmin ? (lang === 'en' ? 'Create an Equb' : 'ኤኩብ ይፍጠሩ') : (lang === 'en' ? 'Request an Equb' : 'ኤኩብ ይጠይቁ')}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {equbs.map((equb, idx) => (
                <motion.div
                  key={equb.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all cursor-pointer border-t-4 border-[#001f3f]"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-[#00d9ff]">{equb.name}</h3>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {equb.is_host && (
                        <span className="px-2 py-1 bg-[#001f3f]/20 text-[#00d9ff] text-xs font-bold rounded-full">
                          {lang === 'en' ? 'Host' : 'አስተዳዳሪ'}
                        </span>
                      )}
                      {equb.membership_status === 'pending' && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full">
                          ⏳ {lang === 'en' ? 'Pending' : 'በመጠበቅ ላይ'}
                        </span>
                      )}
                      {equb.status === 'active' && (
                        <span className="px-2 py-1 bg-[#00d9ff]/20 text-[#00d9ff] text-xs font-bold rounded-full">
                          🟢 {lang === 'en' ? 'Active' : 'ንቁ'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Members' : 'አባላት'}</span>
                      <span className="font-bold text-[#00d9ff]">{equb.member_count}/{equb.total_rounds}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Contribution' : 'መዋጮ'}</span>
                      <span className="font-bold text-[#00d9ff]">
                        ETB {fmt(equb.contribution_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Round' : 'ዙር'}</span>
                      <span className="font-bold text-[#00d9ff]">
                        {equb.current_round}/{equb.total_rounds}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{lang === 'en' ? 'Cycle' : 'ዑደት'}</span>
                      <span className="font-bold">{equb.cycle_days} {lang === 'en' ? 'days' : 'ቀናት'}</span>
                    </div>
                  </div>
                  <Link
                    href={`/equbs/${equb.id}`}
                    className="block text-center w-full bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] font-bold py-3 rounded-lg hover:shadow-lg transition-all"
                  >
                    👁️ {lang === 'en' ? 'View Details' : 'ዝርዝር ይመልከቱ'}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
