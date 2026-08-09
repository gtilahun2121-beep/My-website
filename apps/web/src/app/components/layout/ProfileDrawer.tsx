// ========================================================================
// USER PROFILE DRAWER
// Right-side slide-over: wallet balance, payout pot, active equbs,
// next contribution, my equbs, and sign out.
// ========================================================================

'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Language } from '@/i18n/config';
import { useAuth } from '@/app/context/AuthContext';
import api from '@/app/services/api';
import type { EqubGroup, Wallet } from '@qalnet/shared-types';

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

const MAX_PHOTO_DIM = 256;

/** Reads a file, downscales it to a square-ish JPEG data URL, and returns it. */
function resizeImageToDataUrl(file: File, maxDim = MAX_PHOTO_DIM): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ProfileDrawer({ isOpen, onClose, language }: ProfileDrawerProps) {
  const router = useRouter();
  const { user, signout, updateProfilePhoto } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [equbs, setEqubs] = useState<EqubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAmharic = language === 'am';

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;
    Promise.all([
      api.walletAPI.getBalance().catch(() => null),
      api.equbAPI.getMine().catch(() => []),
    ]).then(([walletRes, equbsRes]) => {
      if (cancelled) return;
      setWallet(walletRes);
      setEqubs(equbsRes || []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, user]);

  const activeEqubs = equbs.filter(
    (e) => e.status === 'active' || e.status === 'open',
  ).length;
  const nextContribution = equbs.reduce(
    (sum, e) => sum + (e.contribution_amount || 0),
    0,
  );
  const payoutPot = equbs.reduce((sum, e) => sum + (e.total_amount || 0), 0);

  const handleSignOut = async () => {
    await signout();
    onClose();
    router.push('/');
  };

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoUploading(true);
    setPhotoMessage(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      await api.userAPI.updateProfile({ profile_photo: dataUrl });
      updateProfilePhoto(dataUrl);
      setPhotoMessage(isAmharic ? 'ፎቶ ተለውጧል ✓' : 'Photo updated ✓');
    } catch {
      setPhotoMessage(isAmharic ? 'ፎቶ ማዘመን አልተሳካም' : 'Could not update photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoUploading(true);
    setPhotoMessage(null);
    try {
      await api.userAPI.updateProfile({ profile_photo: null });
      updateProfilePhoto(null);
      setPhotoMessage(isAmharic ? 'ፎቶ ተወግዷል ✓' : 'Photo removed ✓');
    } catch {
      setPhotoMessage(isAmharic ? 'ፎቶ ማስወገድ አልተሳካም' : 'Could not remove photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');

  const t = {
    profile: isAmharic ? 'መገለጫዬ' : 'My Profile',
    walletBalance: isAmharic ? 'የቦርሳ ሚዛን' : 'Wallet Balance',
    payoutPot: isAmharic ? 'የክፍያ ማሰባሰብያ' : 'Payout Pot',
    activeEqubs: isAmharic ? 'ንቁ Equbs' : 'Active Equbs',
    nextContribution: isAmharic ? 'ቀጣይ መዋጮ' : 'Next Contribution',
    myEqubs: isAmharic ? 'የእኔ Equbs' : 'My Equbs',
    signOut: isAmharic ? 'ውጣ' : 'Sign Out',
    noEqubs: isAmharic ? 'እስካሁን ምንም Equb አልተቀላቀሉም' : 'You haven\'t joined any Equb yet',
    members: isAmharic ? 'አባላት' : 'members',
    round: isAmharic ? 'ዑደት' : 'Round',
    loading: isAmharic ? 'በመጫን ላይ...' : 'Loading...',
    viewAll: isAmharic ? 'ሁሉንም ይመልከቱ' : 'View all',
    available: isAmharic ? 'ክፍት ሚዛን' : 'Available balance',
    totalPot: isAmharic ? 'በእርስዎ Equbs ላይ ያለ ድምር' : 'Total pot across your equbs',
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
            aria-label={t.profile}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0d7e4d] to-[#ce1126] text-white p-6 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black">{t.profile}</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full text-xl leading-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 bg-white rounded-full overflow-hidden flex items-center justify-center text-[#0d7e4d] text-xl font-black uppercase ring-2 ring-[#d4af37]">
                    {user?.profilePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.profilePhoto}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initials || '👤'
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#d4af37] rounded-full flex items-center justify-center text-[#0d7e4d] text-sm shadow-md hover:scale-110 transition-transform"
                    aria-label={isAmharic ? 'ፎቶ ይቀይሩ' : 'Change photo'}
                  >
                    {photoUploading ? '⏳' : '📷'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-lg truncate">
                    {user ? `${user.firstName} ${user.lastName}` : '—'}
                  </p>
                  <p className="text-sm text-white/80 truncate">{user?.phoneNumber}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <p className="text-center text-gray-500 py-10">{t.loading}</p>
              ) : (
                <>
                  {/* Photo status / actions */}
                  {photoMessage && (
                    <p
                      className={`text-sm font-bold text-center py-2 px-3 rounded-xl ${
                        photoMessage.includes('✓')
                          ? 'bg-[#0d7e4d]/10 text-[#0d7e4d]'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {photoMessage}
                    </p>
                  )}
                  {user?.profilePhoto && (
                    <button
                      onClick={handleRemovePhoto}
                      disabled={photoUploading}
                      className="w-full py-2 border border-gray-300 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-50"
                    >
                      {isAmharic ? 'ፎቶ አስወግድ' : 'Remove photo'}
                    </button>
                  )}

                  {/* Wallet balance */}
                  <div className="bg-gradient-to-br from-[#0d7e4d] to-[#0a5c38] rounded-2xl p-5 text-white">
                    <p className="text-sm text-white/80 mb-1">💳 {t.walletBalance}</p>
                    <p className="text-3xl font-black">
                      {wallet?.currency || 'ETB'}{' '}
                      {(wallet?.balance || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-xs text-white/60 mt-1">{t.available}</p>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
                      <p className="text-2xl">🏆</p>
                      <p className="text-lg font-black text-purple-900 mt-1">
                        {(payoutPot || 0).toLocaleString('en-US')}
                      </p>
                      <p className="text-[11px] font-bold text-purple-700 mt-1 leading-tight">
                        {t.payoutPot}
                      </p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                      <p className="text-2xl">👥</p>
                      <p className="text-lg font-black text-blue-900 mt-1">{activeEqubs}</p>
                      <p className="text-[11px] font-bold text-blue-700 mt-1 leading-tight">
                        {t.activeEqubs}
                      </p>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
                      <p className="text-2xl">📅</p>
                      <p className="text-lg font-black text-orange-900 mt-1">
                        {(nextContribution || 0).toLocaleString('en-US')}
                      </p>
                      <p className="text-[11px] font-bold text-orange-700 mt-1 leading-tight">
                        {t.nextContribution}
                      </p>
                    </div>
                  </div>

                  {/* My Equbs */}
                  <div className="bg-white border border-gray-200 rounded-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900">👥 {t.myEqubs}</h3>
                      <button
                        onClick={() => {
                          onClose();
                          router.push('/my-equbs');
                        }}
                        className="text-xs font-bold text-[#0d7e4d] hover:underline"
                      >
                        {t.viewAll} →
                      </button>
                    </div>
                    {equbs.length === 0 ? (
                      <div className="p-4">
                        <p className="text-sm text-gray-500">{t.noEqubs}</p>
                        <button
                          onClick={() => {
                            onClose();
                            router.push('/discover');
                          }}
                          className="mt-3 w-full py-2 bg-[#0d7e4d] text-white font-bold rounded-lg text-sm hover:bg-[#0a5c38]"
                        >
                          {isAmharic ? 'Equb ይቀላቀሉ' : 'Join an Equb'}
                        </button>
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100 max-h-56 overflow-y-auto">
                        {equbs.slice(0, 5).map((equb) => (
                          <li key={equb.id}>
                            <button
                              onClick={() => {
                                onClose();
                                router.push(`/equbs/${equb.id}`);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 text-left"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">
                                  {equb.name || 'Unnamed Equb'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {t.round}: {equb.current_round ?? 0}/{equb.total_rounds ?? 0} •{' '}
                                  {equb.member_count ?? 0} {t.members}
                                </p>
                              </div>
                              <span className="text-sm font-bold text-[#0d7e4d] shrink-0">
                                ETB {equb.contribution_amount || 0}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 shrink-0">
              <button
                onClick={handleSignOut}
                className="w-full bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition-colors"
              >
                🚪 {t.signOut}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default ProfileDrawer;
