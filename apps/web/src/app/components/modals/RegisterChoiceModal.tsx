'use client';

import { motion } from 'framer-motion';
import { Language, defaultLanguage } from '@/i18n/config';

interface RegisterChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: () => void;
  onSignIn: () => void;
  lang?: Language;
}

/**
 * RegisterChoiceModal - First screen when user clicks "Register"
 * Displays two prominent buttons: Sign Up (new user) and Sign In (existing user)
 */
export default function RegisterChoiceModal({
  isOpen,
  onClose,
  onSignUp,
  onSignIn,
  lang = defaultLanguage,
}: RegisterChoiceModalProps) {
  if (!isOpen) return null;

  const getButtonText = (action: 'signup' | 'signin') => {
    if (action === 'signup') {
      return lang === 'en'
        ? 'Create New Account'
        : lang === 'am'
        ? 'አዲስ መስተዋወቅ ፍጠር'
        : lang === 'om'
        ? 'Akkaunt Haaraa Uumuu'
        : 'Akkaunt Haaraa Uumuu';
    }
    return lang === 'en'
      ? 'I Already Have an Account'
      : lang === 'am'
      ? 'ቀድሞ መስተዋወቅ አለብኝ'
      : lang === 'om'
      ? 'Akkaunt Jira'
      : 'Akkaunt Jira';
  };

  const getDescription = (action: 'signup' | 'signin') => {
    if (action === 'signup') {
      return lang === 'en'
        ? 'Join QalNet and start saving with equbs'
        : lang === 'am'
        ? 'QalNet ሊይ ተጣሉ ወደ equbs ጀምር'
        : lang === 'om'
        ? 'QalNet keessatti seena galii equbs keessatti'
        : 'QalNet keessatti seena galii equbs keessatti';
    }
    return lang === 'en'
      ? 'Sign in with your phone number and PIN'
      : lang === 'am'
      ? 'ስልክ ቁጥር እና PIN ጋር ወደ ውስጥ ግባ'
      : lang === 'om'
      ? 'Lakkoofsa bilbilaa fi PIN waliin seensa'
      : 'Lakkoofsa bilbilaa fi PIN waliin seensa';
  };

  return (
    <motion.div
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
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] px-8 py-4 text-center">
          <h2 className="text-xl font-black text-white mb-1">QalNet</h2>
          <p className="text-white/90 font-semibold text-sm">
            {lang === 'en'
              ? 'Ethiopia\'s Digital Equb Platform'
              : lang === 'am'
              ? 'የኢትዮጵያ ዲጂታል Equb መድረክ'
              : 'Dandeetti Dijiitaalaa Equb Ethiopia'}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6 text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-1">
              {lang === 'en'
                ? 'Welcome to QalNet'
                : lang === 'am'
                ? 'ወደ QalNet ደህና መጡ'
                : 'Gara QalNet faakkaatu'}
            </h3>
            <p className="text-sm text-gray-600">
              {lang === 'en'
                ? 'Are you a new member or returning?'
                : lang === 'am'
                ? 'አዲስ አባል ወይም ተመለሱ?'
                : 'Miseensa Haaraa ykn Kaasoo?'}
            </p>
          </div>

          {/* Two Pill-Shaped Buttons */}
          <div className="flex flex-col gap-3">
            {/* Sign Up Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSignUp}
              className="w-full bg-white text-[#0d7e4d] px-6 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300"
            >
              <span>✍️</span>
              <span>{lang === 'en' ? 'Create New Account' : lang === 'am' ? 'አዲስ መስተዋወቅ ፍጠር' : 'Akkaunt Haaraa Uumuu'}</span>
            </motion.button>

            {/* Sign In Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onSignIn}
              className="w-full bg-white text-blue-600 px-6 py-3 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300"
            >
              <span>🔐</span>
              <span>{lang === 'en' ? 'I Already Have an Account' : lang === 'am' ? 'ቀድሞ መስተዋወቅ አለብኝ' : 'Akkaunt Jira'}</span>
            </motion.button>
          </div>

          {/* Trust Badges */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-center text-xs text-gray-600 mb-3">
              {lang === 'en'
                ? 'Trusted by thousands of Ethiopians'
                : lang === 'am'
                ? 'በሺዎች ኢትዮጵያውያን የታመኑ'
                : 'Liqimuun Waaqeffataa Sabaa Itiyoophiya'}
            </p>
            <div className="flex justify-center items-center gap-4 text-gray-600">
              <div className="text-center">
                <div className="text-lg mb-1">🔒</div>
                <p className="text-xs font-semibold">
                  {lang === 'en' ? 'Secure' : lang === 'am' ? 'ደህንነት' : 'Nageenya'}
                </p>
              </div>
              <div className="text-center">
                <div className="text-lg mb-1">✅</div>
                <p className="text-xs font-semibold">
                  {lang === 'en' ? 'Verified' : lang === 'am' ? 'ታገዙ' : 'Himitamte'}
                </p>
              </div>
              <div className="text-center">
                <div className="text-lg mb-1">⚡</div>
                <p className="text-xs font-semibold">
                  {lang === 'en' ? 'Instant' : lang === 'am' ? 'ወዲያውኑ' : 'Yeroo'}
                </p>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full mt-6 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors font-medium"
          >
            {lang === 'en' ? '← Back' : lang === 'am' ? '← ተመለስ' : '← Duubatti'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
