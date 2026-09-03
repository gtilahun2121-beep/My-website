'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import SignUpTab from './AuthModalTabs/SignUpTab';
import SignInTab from './AuthModalTabs/SignInTab';
import ForgotPinTab from './AuthModalTabs/ForgotPinTab';
import ChoiceFlow from './ChoiceFlow';

export type AuthTab = 'signup' | 'signin' | 'forgot';
export type AuthMode = 'tabs' | 'choice';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AuthTab;
  mode?: AuthMode;
  lang?: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

/**
 * Unified Auth Modal Component
 * Two modes:
 * 1. 'tabs' (default) - Traditional tab-based interface for back-compat
 * 2. 'choice' - New flow with Sign Up/Sign In decision screen
 */
export default function AuthModal({
  isOpen,
  onClose,
  initialTab = 'signin',
  mode = 'tabs',
  lang = defaultLanguage,
  onSuccess,
  onError,
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>(initialTab);
  const t = translations[lang];

  // Reset to the requested tab whenever the modal (re)opens or the requested
  // tab changes. Done during render (not in an effect) so the modal always
  // reopens on the initial tab without cascading re-renders.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (isOpen && (prevOpen !== isOpen || initialTab !== prevInitialTab)) {
    setPrevOpen(isOpen);
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  const tabs: { id: AuthTab; label: string; icon: string }[] = [
    { id: 'signup', label: lang === 'en' ? 'Sign Up' : lang === 'am' ? 'ምዝገባ' : lang === 'om' ? 'Galmaa' : 'ምዝገባ', icon: '✍️' },
    { id: 'signin', label: lang === 'en' ? 'Sign In' : lang === 'am' ? 'ወደ ውስጥ ግባ' : lang === 'om' ? 'Seensa' : 'ሰነብ', icon: '🔐' },
    { id: 'forgot', label: lang === 'en' ? 'Forgot PIN' : lang === 'am' ? 'PIN ርሳኸወ' : lang === 'om' ? 'PIN Irraanfate' : 'PIN ርሳኸወ', icon: '🆘' },
  ];

  // If mode is 'choice', use the new ChoiceFlow component
  if (mode === 'choice') {
    return (
      <ChoiceFlow
        isOpen={isOpen}
        onClose={onClose}
        lang={lang}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
  }

  // Otherwise use traditional tab-based interface
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 glass-backdrop flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="glass-form rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#001f3f] to-[#001f3f] px-8 py-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-[#00d9ff]">QalNet</h2>
                <p className="text-sm text-[#00d9ff]/80 font-semibold mt-1">
                  {lang === 'en' ? 'Ethiopia\'s Digital Equb' : 'የኢትዮጵያ ዲጂታል Equb'}
                </p>
              </div>
              <button
                onClick={() => {
                  const shouldClose = confirm('Are you sure you want to close? You must register to access the system.');
                  if (shouldClose) onClose();
                }}
                className="text-2xl text-[#00d9ff] hover:opacity-70 transition-all"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/30 bg-white/25">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-4 px-4 font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    activeTab === tab.id
                      ? 'bg-[#001f3f] text-[#00d9ff] border-b-4 border-[#001f3f]'
                      : 'bg-transparent text-[#00d9ff] hover:bg-white/30'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-8">
              <AnimatePresence mode="wait">
                {activeTab === 'signup' && (
                  <motion.div
                    key="signup"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <SignUpTab lang={lang} onSuccess={onSuccess} onError={onError} />
                  </motion.div>
                )}
                {activeTab === 'signin' && (
                  <motion.div
                    key="signin"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <SignInTab lang={lang} onSuccess={onSuccess} onError={onError} />
                  </motion.div>
                )}
                {activeTab === 'forgot' && (
                  <motion.div
                    key="forgot"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <ForgotPinTab lang={lang} onSuccess={onSuccess} onError={onError} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

