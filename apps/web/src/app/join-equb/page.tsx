'use client';

import { useState } from 'react';
import { Language, defaultLanguage } from '@/i18n/config';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';
import { useEffect } from 'react';
import type { EqubGroup } from '@qalnet/shared-types';

export default function JoinEqubPage() {
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [equbs, setEqubs] = useState<EqubGroup[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      api.equbAPI.getAll()
        .then((data) => setEqubs(data))
        .catch(console.error);
    }
  }, [isAuthenticated]);

  const handleJoin = async (equbId: string) => {
    try {
      const result = await api.equbAPI.join(equbId);
      if (result?.alreadyMember) {
        alert(lang === 'en' ? 'You are already a member of this Equb.' : 'ቀድሞውኑ የዚህ ኢቁብ አባል ነዎት።');
      } else if (result?.pending) {
        alert(lang === 'en' ? 'Join request already submitted — awaiting admin approval.' : 'የመቀላቀል ጥያቄ ቀርቧል — የአስተዳዳሪ ማጽደቅ በመጠበቅ ላይ።');
      } else {
        alert(lang === 'en' ? 'Successfully joined the Equb!' : 'በተሳካ ሁኔታ ተቀላቅለዋል!');
      }
      // Refresh list
      const data = await api.equbAPI.getAll();
      setEqubs(data);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to join Equb.');
    }
  };

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
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">
            {lang === 'en' ? 'Join an Equb ➕' : 'Equb ይቀላቀሉ ➕'}
          </h1>
          <p className="text-gray-600 mb-8">
            {lang === 'en' ? 'Browse available Equb groups and join one that fits your needs' : 'Equb ቡድን ይመልከቱ'}
          </p>

          {/* Filter Options */}
          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input type="text" placeholder={lang === 'en' ? 'Search Equbs...' : 'ፈልግ...'} className="border border-gray-300 rounded-lg px-4 py-2 w-full" />
              <select className="border border-gray-300 rounded-lg px-4 py-2">
                <option>{lang === 'en' ? 'All Sizes' : 'ሁሉ'}</option>
                <option>5-10 members</option>
                <option>10-20 members</option>
                <option>20+ members</option>
              </select>
              <select className="border border-gray-300 rounded-lg px-4 py-2">
                <option>{lang === 'en' ? 'All Categories' : 'ሁሉ'}</option>
                <option>Savings</option>
                <option>Business</option>
                <option>Education</option>
              </select>
              <button className="bg-[#314fa0] text-white font-bold px-6 py-2 rounded-lg hover:bg-[#2a4183]">
                {lang === 'en' ? 'Search' : 'ፈልግ'}
              </button>
            </div>
          </div>

          {/* Equb Listings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {equbs.length > 0 ? equbs.map((equb, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all border-l-4 border-[#314fa0]">
                <h3 className="text-lg font-bold text-gray-900 mb-3">{equb.name || 'Unnamed Equb'}</h3>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{lang === 'en' ? 'Members' : 'አባሎች'}</span>
                    <span className="font-bold">{equb.member_count ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{lang === 'en' ? 'Monthly Contribution' : 'ወር መዋጮ'}</span>
                    <span className="font-bold text-[#314fa0]">ETB {equb.contribution_amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{lang === 'en' ? 'Duration' : 'ጊዜ'}</span>
                    <span className="font-bold">{equb.cycle_days * equb.total_rounds} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{lang === 'en' ? 'Open Slots' : 'ክፍት ቦታ'}</span>
                    <span className={`font-bold ${equb.open_slots === 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {equb.open_slots}
                    </span>
                  </div>
                </div>
                <button
                  disabled={equb.open_slots === 0}
                  onClick={() => handleJoin(equb.id)}
                  className={`w-full font-bold py-2 rounded-lg transition-all ${
                    equb.open_slots === 0
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-[#314fa0] text-white hover:bg-[#2a4183]'
                  }`}
                >
                  {equb.open_slots === 0 ? (lang === 'en' ? 'Full' : 'ሙላ') : (lang === 'en' ? 'Join Now' : 'ተቀላቀል')}
                </button>
              </div>
            )) : (
              <p className="text-gray-500 italic">No Equbs found. Check back later.</p>
            )}
          </div>
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
