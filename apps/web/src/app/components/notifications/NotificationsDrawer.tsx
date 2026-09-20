// ========================================================================
// NOTIFICATIONS DRAWER
// Right-side slide-over listing the user's in-app notifications.
// ========================================================================

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/i18n/config';
import { useNotifications } from '@/app/hooks/useNotifications';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

function timeAgo(iso: string, isAmharic: boolean): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAmharic ? 'አሁን' : 'Just now';
  if (mins < 60) return isAmharic ? `${mins} ደቂቃ` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isAmharic ? `${hours} ሰዓት` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isAmharic ? `${days} ቀን` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(isAmharic ? 'am-ET' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export default function NotificationsDrawer({
  isOpen,
  onClose,
  language,
}: NotificationsDrawerProps) {
  const { notifications, unreadCount, loading, markAllRead, remove } =
    useNotifications(isOpen);

  const isAmharic = language === 'am';

  const t = {
    title: isAmharic ? 'ማስታወቂያዎች' : 'Notifications',
    markAllRead: isAmharic ? 'ሁሉንም እንደተነበበ ምልክት' : 'Mark all as read',
    empty: isAmharic ? 'ምንም ማስታወቂያ የለም' : 'No notifications yet',
    unread: (count: number) => `${count} ${isAmharic ? 'ያልተነበቡ' : 'unread'}`,
    delete: isAmharic ? 'ሰርዝ' : 'Delete',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: 'easeInOut' }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white z-[70] shadow-2xl flex flex-col"
            role="dialog"
            aria-label={t.title}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#001f3f] to-[#001f3f] text-[#00d9ff] p-6 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black flex items-center gap-2">
                  🔔 {t.title}
                  {unreadCount > 0 && (
                    <span className="bg-white text-[#00d9ff] text-xs font-black rounded-full px-2 py-0.5">
                      {unreadCount}
                    </span>
                  )}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-200 rounded-full text-xl leading-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="mt-4 text-sm font-bold text-[#00d9ff]/90 underline hover:text-[#00d9ff]"
                >
                  ✓ {t.markAllRead}
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <p className="text-center text-gray-500 py-10">
                  {isAmharic ? 'በመጫን ላይ...' : 'Loading...'}
                </p>
              ) : notifications.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">🔔</p>
                  <p className="text-gray-500 font-semibold">{t.empty}</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((notif) => (
                    <li
                      key={notif.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${
                        notif.is_read
                          ? 'bg-gray-50 border-gray-100'
                          : 'bg-[#001f3f]/5 border-[#001f3f]/20'
                      }`}
                    >
                      <div className="w-9 h-9 shrink-0 rounded-full bg-white shadow-sm flex items-center justify-center text-lg">
                        {notif.is_read ? '🔔' : '🔴'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#00d9ff] text-sm leading-tight">
                          {notif.title}
                        </p>
                        {notif.body && (
                          <p className="text-xs text-gray-600 mt-0.5">{notif.body}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {timeAgo(notif.created_at, isAmharic)}
                          {!notif.is_read && (
                            <span className="ml-2 text-[#00d9ff] font-bold">
                              {isAmharic ? 'አዲስ' : 'NEW'}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => void remove(notif.id)}
                        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-[#00d9ff] hover:bg-[#001f3f]/10 transition-colors"
                        aria-label={t.delete}
                        title={t.delete}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

