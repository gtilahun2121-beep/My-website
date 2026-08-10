'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { initials, roleLabel } from '../dashboard/format';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export default function ProfileMenu() {
  const { user, signout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`.trim();

  const handleSignOut = async () => {
    setOpen(false);
    await signout();
    router.push('/');
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-2 border-l border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/40 rounded-lg"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {user.profilePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.profilePhoto}
            alt={fullName}
            className="w-9 h-9 rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-accent-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
            {initials(user.firstName, user.lastName)}
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-bold text-slate-800 leading-none">{fullName || 'Member'}</p>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">{roleLabel(user.role)}</p>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          {...stroke}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-72 bg-card rounded-card border border-slate-200 shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
            {user.profilePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.profilePhoto}
                alt={fullName}
                className="w-11 h-11 rounded-full object-cover"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-accent-600 text-white flex items-center justify-center font-bold shrink-0">
                {initials(user.firstName, user.lastName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{fullName || 'QalNet Member'}</p>
              <p className="text-xs text-slate-500 truncate">{user.phoneNumber || user.email || '—'}</p>
            </div>
          </div>

          <div className="py-1.5">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-slate-400" {...stroke}>
                <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-4 7c-4.4 0-8 2.4-8 5.3V21h16v-1.7C20 16.4 16.4 14 12 14Z" />
              </svg>
              My Profile
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 text-slate-400" {...stroke}>
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a8.9 8.9 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8.9 8.9 0 0 0-2-1.2L15.5 3h-4l-.4 2.6a8.9 8.9 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a8.9 8.9 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a8.9 8.9 0 0 0 2 1.2l.4 2.6h4l.4-2.6a8.9 8.9 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z" />
              </svg>
              Settings
            </Link>
          </div>

          <div className="border-t border-slate-100 py-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-danger-600 hover:bg-danger-50"
            >
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" {...stroke}>
                <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3m4 13 5-5m0 0-5-5m5 5H9" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
