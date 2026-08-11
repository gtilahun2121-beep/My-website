// ========================================================================
// USER PROFILE DRAWER
// Right-side slide-over shown on landing pages (home, docs, etc.). Uses a
// list format so the menu reads the same everywhere: back to main
// dashboard (when off it), my profile, settings, and sign out.
// ========================================================================

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/i18n/config';
import { useAuth } from '@/app/context/AuthContext';
import { initials } from '../dashboard/format';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export default function ProfileDrawer({ isOpen, onClose, language }: ProfileDrawerProps) {
  const { user, signout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'QalNet Member';
  const phone = user?.phoneNumber ?? '';

  const isAdmin = user?.role === 'admin';
  const dashPath = isAdmin ? '/admin/dashboard' : '/dashboard';
  const showBackToDashboard = pathname !== dashPath;

  const handleSignOut = async () => {
    await signout();
    router.push('/');
    onClose();
  };

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  const itemBase =
    'flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl text-left';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[100]">
          <motion.div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Account menu"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 200 }}
          >
            {/* Drawer header — profile photo + name */}
            <div className="p-5 border-b border-gray-100 flex items-center gap-3">
              {user?.profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.profilePhoto}
                  alt={fullName}
                  className="w-14 h-14 rounded-full object-cover"
                />
              ) : (
                <div className="w-14 h-14 bg-accent-600 flex items-center justify-center text-white font-bold text-lg rounded-full shrink-0">
                  {initials(user?.firstName ?? '', user?.lastName ?? '')}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-slate-900 truncate">{fullName}</p>
                <p className="text-sm text-slate-500 truncate">{phone}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer body — menu list */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {showBackToDashboard && (
                <button
                  type="button"
                  onClick={() => go(dashPath)}
                  className={`${itemBase} bg-[#314fa0] text-white justify-center`}
                >
                  {language === 'en' ? 'Back to Main Dashboard' : 'ወደ ዋና ዳሽቦርድ ተመለስ'}
                </button>
              )}
              <Link
                href="/profile"
                onClick={onClose}
                className={`${itemBase} bg-gray-100 text-slate-800`}
              >
                <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-4 7c-4.4 0-8 2.4-8 5.3V21h16v-1.7C20 16.4 16.4 14 12 14Z" />
                  </svg>
                </span>
                {language === 'en' ? 'My Profile' : 'የመገለጫዬ'}
              </Link>
              <Link
                href="/settings"
                onClick={onClose}
                className={`${itemBase} bg-gray-100 text-slate-800`}
              >
                <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a8.9 8.9 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8.9 8.9 0 0 0-2-1.2L15.5 3h-4l-.4 2.6a8.9 8.9 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a8.9 8.9 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a8.9 8.9 0 0 0 2 1.2l.4 2.6h4l.4-2.6a8.9 8.9 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z" />
                  </svg>
                </span>
                {language === 'en' ? 'Settings' : 'ቅንብሮች'}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className={`${itemBase} bg-red-50 text-red-600 justify-center`}
              >
                {language === 'en' ? 'Sign out' : 'መውጣት'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}