'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';

export default function CreateEqubPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    contribution_amount: '1000',
    total_rounds: '10',
    cycle_days: '30',
  });

  const t = translations[lang];

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setError(null);

    const name = form.name.trim();
    if (!name) return setError('Equb name is required');
    const contribution = Number(form.contribution_amount);
    const totalRounds = Number(form.total_rounds);
    const cycleDays = Number(form.cycle_days);
    if (!contribution || contribution <= 0) return setError('Enter a valid contribution amount');
    if (!totalRounds || totalRounds <= 0) return setError('Enter a valid number of rounds');
    if (!cycleDays || cycleDays < 3) return setError('Cycle must be at least 3 days');

    setLoading(true);
    try {
      await api.equbAPI.create({
        name,
        description: form.description.trim() || undefined,
        contribution_amount: contribution,
        total_rounds: totalRounds,
        cycle_days: cycleDays,
      });
      setSuccess(true);
      setTimeout(() => router.push('/my-equbs'), 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to create Equb');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex flex-col">
        <Header lang={lang} onLanguageChange={setLang} />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-800 mb-4">
              {lang === 'en' ? 'Please log in to create an Equb' : 'እቁብ ለመፍጠር ይግቡ'}
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
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            {lang === 'en' ? 'Create an Equb 🆕' : 'እቁብ ይፍጠሩ 🆕'}
          </h1>
          <p className="text-gray-600 mb-8">
            {lang === 'en'
              ? 'Launch your own savings circle and invite members to join'
              : 'የራስዎን የቁጠባ ክበብ ይመስርቱ እና አባላትን ይጋብዙ'}
          </p>

          {success ? (
            <div className="bg-green-50 border-2 border-green-400 rounded-xl p-8 text-center">
              <p className="text-5xl mb-4">✅</p>
              <h3 className="text-2xl font-black text-green-800 mb-2">
                {lang === 'en' ? 'Equb Created!' : 'እቁብ ተፈጥሯል!'}
              </h3>
              <p className="text-green-700">
                {lang === 'en' ? 'Redirecting to your Equbs...' : 'ወደ እቁቦችዎ በመሄድ ላይ...'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-8">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {lang === 'en' ? 'Equb Name' : 'የእቁብ ስም'}
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder={lang === 'en' ? 'e.g. Family Savings Circle' : 'ለምሳሌ የቤተሰብ ቁጠባ'}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0d7e4d]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {lang === 'en' ? 'Description (optional)' : 'መግለጫ (አማራጭ)'}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={3}
                    placeholder={lang === 'en' ? 'What is this Equb about?' : 'ይህ እቁብ ስለምንድን ነው?'}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0d7e4d]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      {lang === 'en' ? 'Contribution (ETB)' : 'መዋጮ (ETB)'}
                    </label>
                    <input
                      type="number"
                      value={form.contribution_amount}
                      onChange={(e) => set('contribution_amount', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0d7e4d]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      {lang === 'en' ? 'Total Rounds' : 'ጠቅላላ ዙሮች'}
                    </label>
                    <input
                      type="number"
                      value={form.total_rounds}
                      onChange={(e) => set('total_rounds', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0d7e4d]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      {lang === 'en' ? 'Cycle (days)' : 'ዑደት (ቀናት)'}
                    </label>
                    <input
                      type="number"
                      value={form.cycle_days}
                      onChange={(e) => set('cycle_days', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0d7e4d]"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#0a5c38] text-white font-black rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading
                    ? (lang === 'en' ? 'Creating...' : 'በመፍጠር ላይ...')
                    : (lang === 'en' ? '🚀 Create Equb' : '🚀 እቁብ ይፍጠሩ')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
