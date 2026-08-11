'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export default function AdminLoginPage() {
  const { user, isLoading, signin, signout } = useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isLoading && isAdmin) {
      router.replace('/admin/dashboard');
    }
  }, [isLoading, isAdmin, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const id = identifier.trim();
    const pass = pin.trim();
    if (!id) {
      setError('Enter your QalNet phone number or email.');
      return;
    }
    if (pass.length < 4) {
      setError('Enter your PIN.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await signin(id, pass);
      // AuthContext.signin stores the session; the effect above redirects
      // once user.role === 'admin' lands in state.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-4 py-3 rounded-lg bg-admin-elevated border border-admin-border ' +
    'text-admin-text placeholder:text-admin-disabled text-sm font-semibold ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-colors';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-admin-bg">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 mb-8 group">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-brand-900/50 group-hover:from-brand-600 group-hover:to-brand-800 transition-all">
          Q
        </div>
        <div>
          <p className="text-lg font-black text-admin-text leading-none">QalNet</p>
          <p className="text-xs mt-1 text-admin-muted">Admin Console</p>
        </div>
      </Link>

      <div className="w-full max-w-md rounded-card border border-admin-border bg-admin-card p-8 shadow-xl shadow-slate-900/10">
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-12" aria-busy="true">
            <div className="w-5 h-5 rounded-full border-2 border-admin-border-strong border-t-brand-500 animate-spin" />
            <p className="text-sm font-semibold text-admin-muted">Checking session…</p>
          </div>
        ) : user && !isAdmin ? (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-danger-500/15 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-danger-500" {...stroke}>
                <path d="M12 8v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <h1 className="text-xl font-black text-admin-text">Not an admin account</h1>
            <p className="text-sm text-admin-muted">
              This account does not have admin access. Sign in with an administrator account.
            </p>
            <button
              type="button"
              onClick={async () => {
                await signout();
                setPin('');
                setIdentifier('');
              }}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-bold hover:from-brand-500 hover:to-brand-400 transition-all"
            >
              Sign out and try again
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-black text-admin-text text-center">Admin sign in</h1>
            <p className="text-sm text-admin-muted mt-1 text-center">
              Authenticate with your QalNet phone number or email and PIN.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="identifier" className="block text-xs font-bold text-admin-muted mb-1.5">
                  Phone or email
                </label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. +251 91 000 0000"
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="pin" className="block text-xs font-bold text-admin-muted mb-1.5">
                  PIN
                </label>
                <input
                  id="pin"
                  type="password"
                  autoComplete="current-password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className={inputCls}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-bold hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {submitting ? 'Signing in…' : 'Sign in to Admin'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-admin-border-subtle text-center">
              <Link
                href="/"
                className="text-xs font-bold text-admin-muted hover:text-admin-text transition-colors"
              >
                ← Back to QalNet home
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-admin-disabled">
        Authorized administrator access only.
      </p>
    </div>
  );
}
