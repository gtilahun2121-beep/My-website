'use client';

import { useState } from 'react';
import { Language, defaultLanguage } from '@/i18n/config';
import RegisterChoiceModal from './RegisterChoiceModal';
import SignUpTab from './AuthModalTabs/SignUpTab';
import SignInTab from './AuthModalTabs/SignInTab';
import { motion, AnimatePresence } from 'framer-motion';

type FlowStage = 'choice' | 'signup' | 'signin';

interface ChoiceFlowProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

/**
 * ChoiceFlow Component - Orchestrates the registration/signin flow
 * 
 * Flow:
 * 1. Show RegisterChoiceModal (user picks Sign Up or Sign In)
 * 2. If Sign Up → Show SignUpTab (4-step form)
 * 3. If Sign In → Show SignInTab (phone + PIN)
 * 4. Both routes lead to dashboard on success
 */
export default function ChoiceFlow({
  isOpen,
  onClose,
  lang = defaultLanguage,
  onSuccess,
  onError,
}: ChoiceFlowProps) {
  const [stage, setStage] = useState<FlowStage>('choice');

  // Handle going back from auth screens to choice
  const handleBackToChoice = () => {
    setStage('choice');
  };

  // Handle user selecting Sign Up
  const handleSelectSignUp = () => {
    setStage('signup');
  };

  // Handle user selecting Sign In
  const handleSelectSignIn = () => {
    setStage('signin');
  };

  // Handle success and close the flow
  const handleAuthSuccess = (title: string, message: string, duration?: number) => {
    onSuccess?.(title, message, duration);
    // Flow will close naturally via parent component when auth completes
  };

  const handleAuthError = (title: string, message: string, duration?: number) => {
    onError?.(title, message, duration);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Show Choice Modal during 'choice' stage */}
      <AnimatePresence mode="wait">
        {stage === 'choice' && (
          <RegisterChoiceModal
            isOpen={true}
            onClose={onClose}
            onSignUp={handleSelectSignUp}
            onSignIn={handleSelectSignIn}
            lang={lang}
          />
        )}

        {/* Show SignUp Form during 'signup' stage */}
        {stage === 'signup' && (
          <motion.div
            key="signup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] px-8 py-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">QalNet</h2>
                  <p className="text-sm text-white/80 font-semibold mt-1">
                    {lang === 'en'
                      ? "Ethiopia's Digital Equb"
                      : 'የኢትዮጵያ ዲጂታል Equb'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBackToChoice}
                    className="text-xl text-white hover:opacity-70 transition-all px-3 py-2 rounded-lg hover:bg-white/20"
                    title={lang === 'en' ? 'Back' : 'ተመለስ'}
                  >
                    ←
                  </button>
                  <button
                    onClick={() => {
                      const shouldClose = confirm(
                        lang === 'en'
                          ? 'Are you sure you want to close? You must register to access the system.'
                          : 'እርግጠኛ ናችሁ ወደ ውስጥ ለመዝጋት?'
                      );
                      if (shouldClose) onClose();
                    }}
                    className="text-2xl text-white hover:opacity-70 transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-8">
                <SignUpTab
                  lang={lang}
                  onSuccess={handleAuthSuccess}
                  onError={handleAuthError}
                />
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Show SignIn Form during 'signin' stage */}
        {stage === 'signin' && (
          <motion.div
            key="signin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] px-8 py-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white">QalNet</h2>
                  <p className="text-sm text-white/80 font-semibold mt-1">
                    {lang === 'en'
                      ? "Ethiopia's Digital Equb"
                      : 'የኢትዮጵያ ዲጂታል Equb'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleBackToChoice}
                    className="text-xl text-white hover:opacity-70 transition-all px-3 py-2 rounded-lg hover:bg-white/20"
                    title={lang === 'en' ? 'Back' : 'ተመለስ'}
                  >
                    ←
                  </button>
                  <button
                    onClick={() => {
                      const shouldClose = confirm(
                        lang === 'en'
                          ? 'Are you sure you want to close? You must register to access the system.'
                          : 'እርግጠኛ ናችሁ ወደ ውስጥ ለመዝጋት?'
                      );
                      if (shouldClose) onClose();
                    }}
                    className="text-2xl text-white hover:opacity-70 transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-8">
                <SignInTab
                  lang={lang}
                  onSuccess={handleAuthSuccess}
                  onError={handleAuthError}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
