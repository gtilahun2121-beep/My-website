'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const t = translations[lang];

  if (!isAuthenticated || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-800 mb-4">
            {lang === 'en' ? 'Please log in first' : 'በመጀመሪያ ግባ'}
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            {lang === 'en' ? 'Go to Home' : 'ወደ ቤት ሂድ'}
          </Link>
        </div>
      </main>
    );
  }

  // Check if user is new (first login)
  const isNewUser = !user.id || user.id.includes('user_');

  const [notifications, setNotifications] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([
        api.notificationsAPI.getNotifications().catch(() => []),
        api.walletAPI.getTransactions().catch(() => [])
      ]).then(([notifRes, txnsRes]) => {
        setNotifications(notifRes || []);
        setTransactions(txnsRes || []);
      });
    }
  }, [isAuthenticated]);

  const recentActivity = transactions.slice(0, 5).map((txn: any) => {
    const outgoing = txn.direction === 'payment' || txn.direction === 'withdrawal';
    const icon =
      txn.direction === 'payment'
        ? '💳'
        : txn.direction === 'withdrawal'
          ? '🏦'
          : txn.direction === 'payout'
            ? '🏆'
            : '💰';
    const label =
      txn.direction === 'payment'
        ? 'Payment Completed'
        : txn.direction === 'withdrawal'
          ? 'Withdrawal Completed'
          : txn.direction === 'payout'
            ? 'Payout Received'
            : 'Deposit Completed';
    return {
      icon,
      action: `${lang === 'en' ? label : label}: ${txn.equb_name} (${outgoing ? '-' : '+'}ETB ${Number(txn.amount).toLocaleString('en-US')})`,
      time: new Date(txn.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'am-ET', {
        month: 'short',
        day: 'numeric',
      }),
    };
  });

  return (
    <main className="min-h-screen flex flex-col bg-gray-50">
      <Header
        lang={lang}
        onLanguageChange={(newLang) => setLang(newLang)}
        isAuthenticated={true}
      />

      {/* Main Content */}
      <div className="flex-grow max-w-7xl mx-auto w-full px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-4xl font-black text-gray-900">
              {lang === 'en' ? 'Welcome, ' : 'ደህና መጡ, '}{user.firstName} 👋
            </h1>
          </div>
          <p className="text-gray-600">
            {lang === 'en'
              ? 'Here\'s your Equb dashboard. Stay updated with your group savings.'
              : 'ይህ የእርስዎ Equb ড్ಯಾಶ್ಬೋರ್ಡ್ ነው.'}
          </p>
        </div>

        {/* Getting Started for New Users */}
        {isNewUser && (
          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded-lg mb-8">
            <h2 className="text-lg font-bold text-blue-900 mb-4">
              {lang === 'en' ? '🚀 Getting Started' : '🚀 ለመጀመር'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-lg text-center hover:shadow-lg transition-all cursor-pointer">
                <p className="text-2xl mb-2">✅</p>
                <p className="font-bold text-sm text-blue-900">
                  {lang === 'en' ? 'Fayda Verified' : 'Fayda ታገዙ'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center hover:shadow-lg transition-all cursor-pointer">
                <p className="text-2xl mb-2">📱</p>
                <p className="font-bold text-sm text-blue-900">
                  {lang === 'en' ? 'Phone Verified' : 'ስልክ ታገዙ'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center hover:shadow-lg transition-all cursor-pointer">
                <p className="text-2xl mb-2">➕</p>
                <p className="font-bold text-sm text-blue-900">
                  {lang === 'en' ? 'Join First Equb' : 'መጀመሪያ Equb ተጠምዱ'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center hover:shadow-lg transition-all cursor-pointer">
                <p className="text-2xl mb-2">💳</p>
                <p className="font-bold text-sm text-blue-900">
                  {lang === 'en' ? 'Add Payment Method' : 'ክፍያ ዘዴ ጨምር'}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg text-center hover:shadow-lg transition-all cursor-pointer">
                <p className="text-2xl mb-2">📖</p>
                <p className="font-bold text-sm text-blue-900">
                  {lang === 'en' ? 'Learn How Equb Works' : 'Equb መሠራት ይወቁ'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Three Main Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Quick Actions - Question: What should I do next? */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                ⚡ {lang === 'en' ? 'Quick Actions' : 'ፈጣን ድርጊቶች'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => router.push('/discover')} className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-lg font-bold hover:shadow-lg transition-all text-center">
                  ➕ {lang === 'en' ? 'Join an Equb' : 'Equb ተጠምዱ'}
                </button>
                <button onClick={() => router.push('/create-equb')} className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-lg font-bold hover:shadow-lg transition-all text-center">
                  🆕 {lang === 'en' ? 'Create an Equb' : 'Equb ፍጠር'}
                </button>
                <button onClick={() => router.push('/wallet')} className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 rounded-lg font-bold hover:shadow-lg transition-all text-center">
                  💳 {lang === 'en' ? 'Make Payment' : 'ክፍያ ክፍል'}
                </button>
                <button onClick={() => router.push('/wallet')} className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4 rounded-lg font-bold hover:shadow-lg transition-all text-center">
                  👥 {lang === 'en' ? 'Invite Friends' : 'ጓደኞቹን ጋብዝ'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Notifications & Activity - Question: What has happened recently? */}
          <div>
            {/* Notifications */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                🔔 {lang === 'en' ? 'Notifications' : 'ማስታወቂያዎች'}
              </h2>

              <div className="space-y-3">
                {notifications.length > 0 ? notifications.map((notif, idx) => (
                  <div key={idx} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0 text-sm sm:text-base">
                      {notif.icon || '🔔'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm sm:text-base leading-tight mb-1">{notif.title || notif.message || 'Notification'}</p>
                      <p className="text-xs sm:text-sm text-gray-500">{notif.time || new Date(notif.created_at || Date.now()).toLocaleDateString()}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-gray-500 italic p-4">No notifications.</p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                📊 {lang === 'en' ? 'Recent Activity' : 'ቅርብ ጊዜ ሕይወት'}
              </h2>

              <div className="space-y-3">
                {recentActivity.map((activity, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-3 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{activity.icon}</span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-sm">{activity.action}</p>
                        <p className="text-xs text-gray-600">{activity.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Support Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {lang === 'en' ? 'Need Help?' : 'እርዳታ ያስፈልገ?'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all">
              📚 {lang === 'en' ? 'Help Center' : 'ረዳት ማእከል'}
            </button>
            <button className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all">
              💬 {lang === 'en' ? 'Live Chat' : 'ቀጥታ ውይይት'}
            </button>
            <button className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-all">
              ⚠️ {lang === 'en' ? 'Report Issue' : 'ችግር ሪፖርት'}
            </button>
          </div>
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}
