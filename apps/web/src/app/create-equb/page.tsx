'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PresetTemplates, { PresetTemplate } from '@/app/components/PresetTemplates';
import api from '@/app/services/api';

export default function CreateEqubPage() {
  const { isAuthenticated, user } = useAuth();
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

  const isAdmin = user?.role === 'admin';
  const t = translations[lang];

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSelectTemplate = (template: PresetTemplate) => {
    setForm({
      name: template.name,
      description: template.description || '',
      contribution_amount: template.contribution_amount.toString(),
      total_rounds: template.total_rounds.toString(),
      cycle_days: template.cycle_days.toString(),
    });
    // Scroll to form
    setTimeout(() => {
      document.querySelector('[data-form-section]')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

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

    const payload = {
      name,
      description: form.description.trim() || undefined,
      contribution_amount: contribution,
      total_rounds: totalRounds,
      cycle_days: cycleDays,
    };

    setLoading(true);
    try {
      if (isAdmin) {
        await api.equbAPI.create(payload);
        setSuccess(true);
        setTimeout(() => router.push('/my-equbs'), 1500);
      } else {
        await api.equbAPI.requestCreate(payload);
        setSuccess(true);
        setTimeout(() => router.push('/my-equbs'), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
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
            <p className="text-xl font-bold text-[#00d9ff] mb-4">
              {lang === 'en' ? 'Please log in to continue' : 'ለመቀጠል ይግቡ'}
            </p>
            <Link href="/" className="text-brand-600 hover:underline">
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
        <div className="max-w-6xl mx-auto">
          {isAdmin ? (
            <h1 className="text-3xl sm:text-4xl font-black text-[#00d9ff] mb-2">
              {lang === 'en' ? 'Create an Equb 🆕' : 'እቁብ ይፍጠሩ 🆕'}
            </h1>
          ) : (
            <h1 className="text-3xl sm:text-4xl font-black text-[#00d9ff] mb-2">
              {lang === 'en' ? 'Request an Equb 🙋' : 'እቁብ ይጠይቁ 🙋'}
            </h1>
          )}

          {isAdmin ? (
            <p className="text-gray-600 mb-8">
              {lang === 'en'
                ? 'Launch an Equb circle on the platform. You will host it and approve its members.'
                : 'በመድረኩ ላይ የእቁብ ክበብ ይፍጠሩ። እርስዎ ያስተናግዱታል እና አባላቱን ያጸድቃሉ።'}
            </p>
          ) : (
            <p className="text-gray-600 mb-8">
              {lang === 'en'
                ? 'Only admins create Equbs. Send your preferred Equb details below and the admin will review and approve it for you.'
                : 'እቁብ የሚፈጥሩት አስተዳዳሪዎች ብቻ ናቸው። የሚፈልጉትን የእቁብ ዝርዝር ከታች ይላኩ፣ አስተዳዳሪው ይመረምራል እና ያጸድቅልዎታል።'}
            </p>
          )}

          {success ? (
            <div className="bg-brand-50 border-2 border-brand-400 rounded-xl p-8 text-center">
              <p className="text-5xl mb-4"></p>
              <h3 className="text-2xl font-black text-brand-800 mb-2">
                {isAdmin
                  ? (lang === 'en' ? 'Equb Created!' : 'እቁብ ተፈጥሯል!')
                  : (lang === 'en' ? 'Request Submitted!' : 'ጥያቄ ቀርቧል!')}
              </h3>
              <p className="text-brand-700">
                {isAdmin
                  ? (lang === 'en' ? 'Redirecting to your Equbs...' : 'ወደ እቁቦችዎ በመሄድ ላይ...')
                  : (lang === 'en' ? 'The admin will review your request shortly. Redirecting...' : 'አስተዳዳሪው ጥያቄዎን በቅርቡ ይመለከታል። በመሄድ ላይ...')}
              </p>
            </div>
          ) : (
            <>
              <PresetTemplates lang={lang} onSelectTemplate={handleSelectTemplate} />

              <div data-form-section className="bg-white rounded-xl shadow-md p-8 border-t-4 border-[#001f3f] max-w-3xl">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-[#00d9ff] mb-1">
                    {lang === 'en' ? 'Equb Name' : 'የእቁብ ስም'}
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder={lang === 'en' ? 'e.g. Family Savings Circle' : 'ለምሳሌ የቤተሰብ ቁጠባ'}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-[#001f3f]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#00d9ff] mb-1">
                    {lang === 'en' ? 'Description (optional)' : 'መግለጫ (አማራጭ)'}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={3}
                    placeholder={lang === 'en' ? 'What is this Equb about?' : 'ይህ እቁብ ስለምንድን ነው?'}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-[#001f3f]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-[#00d9ff] mb-1">
                      {lang === 'en' ? 'Contribution (ETB)' : 'መዋጮ (ETB)'}
                    </label>
                    <input
                      type="number"
                      value={form.contribution_amount}
                      onChange={(e) => set('contribution_amount', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-[#001f3f]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#00d9ff] mb-1">
                      {lang === 'en' ? 'Total Rounds' : 'ጠቅላላ ዙሮች'}
                    </label>
                    <input
                      type="number"
                      value={form.total_rounds}
                      onChange={(e) => set('total_rounds', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-[#001f3f]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[#00d9ff] mb-1">
                      {lang === 'en' ? 'Cycle (days)' : 'ዑደት (ቀናት)'}
                    </label>
                    <input
                      type="number"
                      value={form.cycle_days}
                      onChange={(e) => set('cycle_days', e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-[#001f3f]"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-brand-50 border-l-4 border-brand-500 text-brand-700 p-4 rounded">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] font-black rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading
                    ? (lang === 'en' ? 'Submitting...' : 'በመላክ ላይ...')
                    : isAdmin
                      ? (lang === 'en' ? 'Create Equb' : 'እቁብ ይፍጠሩ')
                      : (lang === 'en' ? 'Submit Request to Admin' : 'ጥያቄ ለአስተዳዳሪ ይላኩ')}
                </button>
              </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
