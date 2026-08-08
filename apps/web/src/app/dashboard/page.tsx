'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { useAuth } from '@/app/context/AuthContext';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import api from '@/app/services/api';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { user, isAuthenticated, signout } = useAuth();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const t = translations[lang];

  console.log('🔍 Dashboard Page Loaded');
  console.log('isAuthenticated:', isAuthenticated);
  console.log('user:', user);

  if (!isAuthenticated || !user) {
    console.log('❌ Not authenticated, redirecting...');
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

  console.log('✅ User authenticated, showing dashboard');

  // Check if user is new (first login)
  const isNewUser = !user.id || user.id.includes('user_');

  const [walletBalance, setWalletBalance] = useState(0);
  const [equbs, setEqubs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      Promise.all([
        api.walletAPI.getBalance().catch(() => ({ balance: 0 })),
        api.equbAPI.getAll().catch(() => []),
        api.notificationsAPI.getNotifications().catch(() => [])
      ]).then(([walletRes, equbsRes, notifRes]) => {
        setWalletBalance(walletRes.balance || 0);
        setEqubs(equbsRes || []);
        setNotifications(notifRes || []);
      });
    }
  }, [isAuthenticated]);

  const activeEqubs = equbs.length;
  const nextPaymentDays = 5;
  const nextPayoutMonths = 3;

  const recentActivity = [
    {
      icon: '✅',
      action: lang === 'en' ? 'Payment Completed' : 'ክፍያ ተጠናቀቀ',
      time: '2 hours ago',
    },
    {
      icon: '➕',
      action: lang === 'en' ? 'Joined Gold Equb' : 'Gold Equb ተጠምዱ',
      time: '1 day ago',
    },
    {
      icon: '✏️',
      action: lang === 'en' ? 'Profile Updated' : 'ፕሮፋይል ተዘምነ',
      time: '3 days ago',
    },
  ];

  const handleSignOut = () => {
    signout();
  };

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
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all"
            >
              {lang === 'en' ? 'Sign Out' : 'ወጣ'}
            </button>
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

        {/* Summary Cards - The 3 Key Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1: Wallet Balance */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-300 rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-700 font-bold text-sm">
                {lang === 'en' ? 'Wallet Balance' : 'ዋሊት ሚዛን'}
              </p>
              <p className="text-2xl">💰</p>
            </div>
            <p className="text-3xl font-black text-green-900">
              ETB {walletBalance.toLocaleString()}
            </p>
            <p className="text-xs text-green-700 mt-2">
              {lang === 'en' ? 'Available balance' : 'ክፍት ሚዛን'}
            </p>
          </div>

          {/* Card 2: Active Equbs */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-300 rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-blue-700 font-bold text-sm">
                {lang === 'en' ? 'Active Equbs' : 'ንቅናቄ Equbs'}
              </p>
              <p className="text-2xl">👥</p>
            </div>
            <p className="text-3xl font-black text-blue-900">{activeEqubs}</p>
            <p className="text-xs text-blue-700 mt-2">
              {lang === 'en' ? 'Groups you\'re part of' : 'ነዋ ክፍሎች'}
            </p>
          </div>

          {/* Card 3: Next Payment Date */}
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-300 rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-orange-700 font-bold text-sm">
                {lang === 'en' ? 'Next Payment' : 'ቀጣይ ክፍያ'}
              </p>
              <p className="text-2xl">📅</p>
            </div>
            <p className="text-3xl font-black text-orange-900">{nextPaymentDays} days</p>
            <p className="text-xs text-orange-700 mt-2">
              {lang === 'en' ? 'Payment due soon' : 'ክፍያ ቀርቧል'}
            </p>
          </div>

          {/* Card 4: Next Payout Date */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-300 rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-2">
              <p className="text-purple-700 font-bold text-sm">
                {lang === 'en' ? 'Next Payout' : 'ቀጣይ ክፍሌ'}
              </p>
              <p className="text-2xl">🏆</p>
            </div>
            <p className="text-3xl font-black text-purple-900">{nextPayoutMonths}m away</p>
            <p className="text-xs text-purple-700 mt-2">
              {lang === 'en' ? 'When you receive payout' : 'ክፍሌ የሚገኙበት ጊዜ'}
            </p>
          </div>
        </div>

        {/* Three Main Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Section 1: My Equbs - Question: What is my current Equb status? */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                👥 {lang === 'en' ? 'My Equbs' : 'የእኔ Equbs'}
              </h2>

              {equbs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">
                    {lang === 'en' ? 'You haven\'t joined any Equb yet' : 'አሁንም ሙሉ Equb ተጠምዱ አልነበሩም'}
                  </p>
                  <button className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all">
                    {lang === 'en' ? 'Join an Equb' : 'Equb ተጠምዱ'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {equbs.map((equb, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 sm:p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-lg sm:text-xl shrink-0">
                          {equb.name ? equb.name.charAt(0) : 'E'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 truncate">{equb.name || 'Unnamed Equb'}</h4>
                          <p className="text-xs sm:text-sm text-gray-500 truncate">
                            {lang === 'en' ? 'Position' : 'ተራ'}: {equb.position || 'N/A'} • {equb.members?.length || equb.size || 0} {lang === 'en' ? 'members' : 'አባሎች'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-bold text-[#0d7e4d] text-sm sm:text-base">ETB {equb.contributionAmount || equb.contribution || 0}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {lang === 'en' ? 'Next' : 'ቀጣይ'}: {equb.nextPaymentDate || 'N/A'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions - Question: What should I do next? */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                ⚡ {lang === 'en' ? 'Quick Actions' : 'ፈጣን ድርጊቶች'}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-lg font-bold hover:shadow-lg transition-all text-center">
                  ➕ {lang === 'en' ? 'Join an Equb' : 'Equb ተጠምዱ'}
                </button>
                <button className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-lg font-bold hover:shadow-lg transition-all text-center">
                  🆕 {lang === 'en' ? 'Create an Equb' : 'Equb ፍጠር'}
                </button>
                <button className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 rounded-lg font-bold hover:shadow-lg transition-all text-center">
                  💳 {lang === 'en' ? 'Make Payment' : 'ክፍያ ክፍል'}
                </button>
                <button className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4 rounded-lg font-bold hover:shadow-lg transition-all text-center">
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
