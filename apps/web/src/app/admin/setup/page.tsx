'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Language, defaultLanguage } from '@/i18n/config';
import { initializeDemoAdmins, getDemoAdminCredentials } from '@/app/lib/adminSetup';

export default function AdminSetupPage() {
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [initialized, setInitialized] = useState(false);
  const [credentials] = useState(getDemoAdminCredentials());

  useEffect(() => {
    // Check if already initialized
    const check = localStorage.getItem('qalnet_admin_setup_done');
    setInitialized(!!check);
  }, []);

  const handleInitialize = () => {
    initializeDemoAdmins();
    localStorage.setItem('qalnet_admin_setup_done', 'true');
    setInitialized(true);
  };

  return (
    <>
      <Header lang={lang} onLanguageChange={setLang} />

      <div className="min-h-screen bg-gradient-to-br from-[#f5f3f0] to-[#ece8e3] py-12">
        <div className="max-w-2xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 shadow-xl"
          >
            <h1 className="text-3xl font-black text-[#0d7e4d] mb-2 text-center">
              👑 Admin Portal Setup
            </h1>
            <p className="text-center text-gray-600 mb-8">
              Initialize demo admin accounts for testing
            </p>

            {!initialized ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Demo Mode:</strong> This creates test admin accounts. 
                    In production, use a secure identity provider (Auth0, Cognito, etc.)
                  </p>
                </div>

                <motion.button
                  onClick={handleInitialize}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-4 bg-gradient-to-r from-purple-600 to-red-600 text-white font-black text-lg rounded-full hover:shadow-lg transition-all"
                >
                  🚀 Initialize Demo Admins
                </motion.button>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <p className="font-black text-blue-900 mb-3">📋 Demo Credentials:</p>
                  <div className="space-y-3">
                    {credentials.map((cred, idx) => (
                      <div key={idx} className="bg-white p-3 rounded border-l-4 border-blue-500 text-sm">
                        <p className="font-bold text-[#0d7e4d]">{cred.role}</p>
                        <p className="text-xs text-gray-600">📧 {cred.email}</p>
                        <p className="text-xs text-gray-600">🔑 {cred.password}</p>
                        <p className="text-xs text-gray-600">🔐 MFA: {cred.mfa}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-6"
              >
                <div className="text-6xl animate-bounce">✅</div>
                <h2 className="text-2xl font-black text-[#0d7e4d]">
                  Setup Complete!
                </h2>
                <p className="text-gray-600">
                  Demo admin accounts have been initialized. You can now log in with any of the credentials below.
                </p>

                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-left">
                  <p className="font-black text-green-900 mb-3">✓ Available Admin Accounts:</p>
                  <div className="space-y-2 text-sm">
                    {credentials.map((cred, idx) => (
                      <div key={idx} className="text-gray-700">
                        <strong>{cred.role}</strong> - {cred.email}
                      </div>
                    ))}
                  </div>
                </div>

                <motion.div
                  className="space-y-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.a
                    href="/auth?mode=admin"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="block py-3 bg-gradient-to-r from-purple-600 to-red-600 text-white font-black rounded-full hover:shadow-lg transition-all text-center"
                  >
                    🔐 Go to Admin Login
                  </motion.a>
                  <motion.a
                    href="/"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="block py-3 border-2 border-[#0d7e4d] text-[#0d7e4d] font-black rounded-full hover:bg-[#0d7e4d]/10 transition-all text-center"
                  >
                    🏠 Go to Home
                  </motion.a>
                </motion.div>
              </motion.div>
            )}
          </motion.div>

          {/* Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 bg-white rounded-2xl p-6 shadow-lg"
          >
            <h3 className="text-xl font-black text-[#0d7e4d] mb-4">
              🔑 Admin Roles Explained
            </h3>

            <div className="space-y-4">
              <div className="border-l-4 border-[#0d7e4d] pl-4">
                <h4 className="font-black text-[#0d7e4d]">👑 Super Admin</h4>
                <p className="text-sm text-gray-600">
                  Full access. Can manage all users, approve KYC, handle disputes, view finances, and manage other admins.
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-black text-green-700">✅ KYC Approver</h4>
                <p className="text-sm text-gray-600">
                  Reviews member KYC documents. Can approve or reject documents with notes.
                </p>
              </div>

              <div className="border-l-4 border-yellow-500 pl-4">
                <h4 className="font-black text-yellow-700">⚖️ Dispute Manager</h4>
                <p className="text-sm text-gray-600">
                  Investigates and resolves disputes between members. Protects member interests.
                </p>
              </div>

              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-black text-blue-700">💰 Finance Auditor</h4>
                <p className="text-sm text-gray-600">
                  Reviews financial records, generates reports, ensures compliance and accuracy.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Security Notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8 bg-red-50 border-2 border-red-200 rounded-2xl p-6"
          >
            <h3 className="text-lg font-black text-red-900 mb-3">
              🔒 Security Notice
            </h3>
            <ul className="text-sm text-red-800 space-y-2">
              <li>✓ Never share admin credentials via email or chat</li>
              <li>✓ Use MFA for all admin accounts in production</li>
              <li>✓ Rotate passwords every 90 days</li>
              <li>✓ Audit all admin actions for compliance</li>
              <li>✓ Use strong, unique passwords (min 12 characters)</li>
              <li>✓ Enable encryption for all data transfers</li>
            </ul>
          </motion.div>
        </div>
      </div>

      <Footer lang={lang} />
    </>
  );
}
