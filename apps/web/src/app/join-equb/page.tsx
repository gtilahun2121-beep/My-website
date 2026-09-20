'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Language, defaultLanguage } from '@/i18n/config';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';
import type { EqubGroup } from '@qalnet/shared-types';
import { motion } from 'framer-motion';

export default function JoinEqubPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [equbs, setEqubs] = useState<EqubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    api.equbAPI.getAll()
      .then((data) => {
        setEqubs(data);
        setLoading(false);
      })
      .catch((err) => {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load Equbs. Please try again.';
        setError(errorMsg);
        setLoading(false);
      });
  }, [isAuthenticated]);

  const handleJoin = async (equbId: string) => {
    setJoiningId(equbId);
    setSuccessMessage(null);
    
    try {
      const result = await api.equbAPI.join(equbId);
      let msg = '';
      
      if (result?.alreadyMember) {
        msg = lang === 'en' ? 'You are already a member of this Equb.' : 'ቀድሞውኑ የዚህ ኢቁብ አባል ነዎት።';
      } else if (result?.alreadyRequested) {
        msg = lang === 'en' ? 'Join request already submitted — awaiting admin approval.' : 'የመቀላቀል ጥያቄ ቀርቧል — የአስተዳዳሪ ማጽደቅ በመጠበቅ ላይ።';
      } else if (result?.pending) {
        msg = lang === 'en' ? 'Join request submitted — awaiting admin approval!' : 'የመቀላቀል ጥያቄ ተቀርቧል!';
      } else {
        msg = lang === 'en' ? 'Successfully joined the Equb!' : 'በተሳካ ሁኔታ ተቀላቅለዋል!';
      }
      
      setSuccessMessage(msg);

      // My Equbs is the member's source of truth after joining. Keep the
      // notice across navigation so the user can immediately see the
      // membership or pending-approval state there.
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('qalnet_join_notice', msg);
      }
      setTimeout(() => router.push('/my-equbs'), 900);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to join Equb. Please try again.';
      setError(errorMsg);
    } finally {
      setJoiningId(null);
    }
  };

  const filteredEqubs = equbs.filter((equb) =>
    equb.name.toLowerCase().includes(searchTerm.toLowerCase())
  );


  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col">
        <Header lang={lang} onLanguageChange={setLang} />
        <div className="flex-grow flex items-center justify-center bg-gradient-to-b from-[#001f3f] to-[#001f3f]">
          <div className="text-center">
            <p className="text-xl font-bold text-[#00d9ff] mb-4">
              {lang === 'en' ? 'Please log in to join an Equb' : 'Equb ለመቀላቀል ይግቡ'}
            </p>
          </div>
        </div>
        <Footer lang={lang} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      <Header lang={lang} onLanguageChange={setLang} isAuthenticated={true} />

      <div className="flex-grow py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#00d9ff] mb-3">
              {lang === 'en' ? 'Join an Equb' : 'Equb ይቀላቀሉ'}
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl">
              {lang === 'en' ? 'Browse available Equb groups and join one that fits your needs. Your request will be reviewed by the admin.' : 'Equb ቡድን ይመልከቱ እና ከሚመጥጡ ውስጥ ይቀላቀሉ።'}
            </p>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg"
            >
              <p className="text-red-600 font-bold">{lang === 'en' ? 'Error' : 'ስህተት'}:</p>
              <p className="text-red-500 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 text-sm font-bold mt-2 hover:underline"
              >
                {lang === 'en' ? 'Dismiss' : 'ዝጋ'}
              </button>
            </motion.div>
          )}

          {/* Success Message */}
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#00d9ff]/10 border-l-4 border-[#00d9ff] p-4 mb-6 rounded-r-lg"
            >
              <p className="text-[#00d9ff] font-bold">✓ {lang === 'en' ? 'Success' : 'ተሳክቷል'}!</p>
              <p className="text-[#00d9ff]/80 text-sm">{successMessage}</p>
            </motion.div>
          )}

          {/* Search Box */}
          <div className="mb-8">
            <input
              type="text"
              placeholder={lang === 'en' ? 'Search Equbs by name...' : 'ስም ያህል ፈልግ...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#00d9ff] text-gray-800"
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full border-4 border-[#00d9ff]/20 border-t-[#00d9ff] animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-semibold">
                  {lang === 'en' ? 'Loading available Equbs...' : 'Equb ክለሳ በእንቅስቃሴ ላይ...'}
                </p>
              </div>
            </div>
          )}

          {/* Equb Listings Grid */}
          {!loading && (
            <>
              {filteredEqubs.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {filteredEqubs.map((equb, idx) => (
                    <motion.div
                      key={equb.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all border-t-4 border-[#001f3f] overflow-hidden"
                    >
                      {/* Card Header */}
                      <div className="bg-gradient-to-r from-[#001f3f] to-[#001f3f] px-6 py-4">
                        <h3 className="text-lg font-black text-[#00d9ff] mb-1">{equb.name || 'Unnamed Equb'}</h3>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                            equb.status === 'open'
                              ? 'bg-[#00d9ff]/20 text-[#00d9ff]'
                              : equb.status === 'active'
                              ? 'bg-[#0066ff]/20 text-[#0066ff]'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {equb.status}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">
                              {lang === 'en' ? 'Contribution' : 'መዋጮ'}
                            </p>
                            <p className="text-lg font-black text-[#00d9ff]">
                              ETB {Number(equb.contribution_amount).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">
                              {lang === 'en' ? 'Members' : 'አባሎች'}
                            </p>
                            <p className="text-lg font-black text-gray-800">
                              {equb.member_count} / {equb.total_rounds}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">
                              {lang === 'en' ? 'Cycle' : 'ዑደት'}
                            </p>
                            <p className="text-lg font-black text-gray-800">
                              {equb.cycle_days} {lang === 'en' ? 'days' : 'ቀናት'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-bold">
                              {lang === 'en' ? 'Open Slots' : 'ክፍት ቦታ'}
                            </p>
                            <p
                              className={`text-lg font-black ${
                                equb.open_slots === 0 ? 'text-gray-400' : 'text-[#0066ff]'
                              }`}
                            >
                              {equb.open_slots}
                            </p>
                          </div>
                        </div>

                        {/* Join Button */}
                        <button
                          disabled={equb.open_slots === 0 || joiningId === equb.id}
                          onClick={() => handleJoin(equb.id)}
                          className={`w-full font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
                            equb.open_slots === 0
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : joiningId === equb.id
                              ? 'bg-[#0066ff]/50 text-[#00d9ff] cursor-wait'
                              : 'bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] hover:shadow-lg hover:scale-105'
                          }`}
                        >
                          {joiningId === equb.id ? (
                            <>
                              <div className="w-4 h-4 rounded-full border-2 border-[#00d9ff]/50 border-t-[#00d9ff] animate-spin" />
                              {lang === 'en' ? 'Joining...' : 'መቀላቀል...'}
                            </>
                          ) : equb.open_slots === 0 ? (
                            <>
                              <span>❌</span>
                              {lang === 'en' ? 'Full' : 'ሙላ'}
                            </>
                          ) : (
                            <>
                              <span>➕</span>
                              {lang === 'en' ? 'Join Now' : 'ይቀላቀሉ'}
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : searchTerm ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16"
                >
                  <p className="text-gray-500 text-lg font-semibold">
                    {lang === 'en' ? `No Equbs found matching "${searchTerm}"` : 'Equb አልተገኘም'}
                  </p>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-[#00d9ff] font-bold mt-4 hover:underline"
                  >
                    {lang === 'en' ? 'Clear search' : 'ወጣ'}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-16"
                >
                  <p className="text-gray-500 text-lg font-semibold">
                    {lang === 'en' ? 'No Equbs available. Check back later!' : 'Equb አልተገኘም'}
                  </p>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
