'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, TwoFactorRequiredError } from '@/app/context/AuthContext';
import { authAPI } from '@/app/services/api';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export default function AdminLoginPage() {
  const { user, isLoading, signin, verify2FALogin, signout } = useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 2FA second step
  const [mfaToken, setMfaToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  // Forgot-PIN reset flow (phone → OTP → new PIN)
  const [resetMode, setResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<'phone' | 'otp'>('phone');
  const [resetPhone, setResetPhone] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetInfo, setResetInfo] = useState('');

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
    if (!/^\d{4,6}$/.test(pass)) {
      setError('Enter your 4-6 digit PIN.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      await signin(id, pass);
      // AuthContext.signin stores the session; the effect above redirects
      // once user.role === 'admin' lands in state.
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        setMfaToken(err.mfaToken);
        setOtpCode('');
        setError('');
        return;
      }
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpSubmitting) return;
    const code = otpCode.trim();
    if (code.length < 6 || code.length > 20) {
      setError('Enter the 6-digit code from your authenticator app, or a backup code.');
      return;
    }
    setError('');
    setOtpSubmitting(true);
    try {
      await verify2FALogin(mfaToken, code);
      // redirect happens via the isAdmin effect above once the session lands
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setOtpSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-4 py-3 rounded-lg bg-admin-elevated border border-admin-border ' +
    'text-admin-text placeholder:text-admin-disabled text-sm font-semibold ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 transition-colors';

  // ── Forgot-PIN flow ────────────────────────────────────────────────────

  const handleForgotPhone = async () => {
    setResetError('');
    setResetInfo('');
    const phone = resetPhone.trim();
    if (!/^\+?[1-9]\d{1,14}$/.test(phone)) {
      setResetError('Enter the QalNet phone number registered to your account.');
      return;
    }
    setResetBusy(true);
    try {
      const result = await authAPI.forgotPin(phone);
      // Backend returns the code as dev_otp outside production (no SMS gateway yet).
      if (result.dev_otp) {
        setResetInfo(`Development OTP: ${result.dev_otp}`);
      }
      setResetStep('otp');
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Could not send a verification code.');
    } finally {
      setResetBusy(false);
    }
  };

  const handleResetPin = async () => {
    setResetError('');
    if (!/^\d{6}$/.test(resetOtp)) {
      setResetError('OTP must be exactly 6 digits.');
      return;
    }
    if (!/^\d{6}$/.test(newPin)) {
      setResetError('New PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      setResetError('PINs do not match.');
      return;
    }
    setResetBusy(true);
    try {
      await authAPI.resetPin(resetPhone.trim(), resetOtp, newPin);
      setResetError('');
      setResetInfo('Your PIN has been reset. Sign in with your new PIN.');
      setResetMode(false);
      setPin('');
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'PIN reset failed.');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-admin-bg">
      {/* Brand */}
      <Link href="/" className="flex items-center gap-3 mb-8 group">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#0066ff]/50 group-hover:from-brand-600 group-hover:to-[#0052d6] transition-all">
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
        ) : mfaToken ? (
          <>
            <h1 className="text-xl font-black text-admin-text text-center">Two-factor authentication</h1>
            <p className="text-sm text-admin-muted mt-1 text-center">
              Enter the 6-digit code from your authenticator app (or a backup code).
            </p>

            <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="otp-code" className="block text-xs font-bold text-admin-muted mb-1.5">
                  Authentication code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 20))}
                  placeholder="000000"
                  className={`${inputCls} text-center tracking-widest`}
                />
                <p className="text-xs text-admin-muted mt-1">
                  Backup codes are single-use and formatted like XXXX-XXXX.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={otpSubmitting}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-bold hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {otpSubmitting ? 'Verifying…' : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMfaToken('');
                  setOtpCode('');
                  setError('');
                }}
                className="w-full text-xs font-bold text-admin-muted hover:text-admin-text transition-colors"
              >
                ← Use a different code
              </button>
            </form>
          </>
        ) : resetMode ? (
          <>
            <h1 className="text-xl font-black text-admin-text text-center">Reset your PIN</h1>
            <p className="text-sm text-admin-muted mt-1 text-center">
              Recover your admin access with a verification code.
            </p>

            {resetStep === 'phone' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleForgotPhone();
                }}
                className="mt-6 space-y-4"
              >
                <div>
                  <label htmlFor="reset-phone" className="block text-xs font-bold text-admin-muted mb-1.5">
                    Registered phone number
                  </label>
                  <input
                    id="reset-phone"
                    type="tel"
                    autoComplete="tel"
                    value={resetPhone}
                    onChange={(e) => setResetPhone(e.target.value)}
                    placeholder="e.g. +251 91 000 0000"
                    className={inputCls}
                  />
                </div>

                {resetError && (
                  <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-600">
                    {resetError}
                  </div>
                )}
                {resetInfo && (
                  <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm font-semibold text-brand-600">
                    {resetInfo}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetBusy}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-bold hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {resetBusy ? 'Sending code…' : 'Send verification code'}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleResetPin();
                }}
                className="mt-6 space-y-4"
              >
                <div>
                  <label htmlFor="reset-otp" className="block text-xs font-bold text-admin-muted mb-1.5">
                    Verification code
                  </label>
                  <input
                    id="reset-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="new-pin" className="block text-xs font-bold text-admin-muted mb-1.5">
                    New 6-digit PIN
                  </label>
                  <div className="relative">
                    <input
                      id="new-pin"
                      type={showNewPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPin((v) => !v)}
                      aria-label="Show/Hide PIN"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-[#0066ff] hover:bg-gray-100 transition-colors"
                    >
                      {!showNewPin ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-pin" className="block text-xs font-bold text-admin-muted mb-1.5">
                    Confirm new PIN
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-pin"
                      type={showConfirmPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPin((v) => !v)}
                      aria-label="Show/Hide PIN"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-[#0066ff] hover:bg-gray-100 transition-colors"
                    >
                      {!showConfirmPin ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                {resetError && (
                  <div className="rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm font-semibold text-danger-600">
                    {resetError}
                  </div>
                )}
                {resetInfo && (
                  <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm font-semibold text-brand-600">
                    {resetInfo}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetBusy}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-bold hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {resetBusy ? 'Resetting…' : 'Reset PIN'}
                </button>

                <button
                  type="button"
                  onClick={() => setResetStep('phone')}
                  className="w-full py-2 text-xs font-bold text-admin-muted hover:text-admin-text transition-colors"
                >
                  ← Use a different phone
                </button>
              </form>
            )}

            <button
              type="button"
              onClick={() => {
                setResetMode(false);
                setResetStep('phone');
                setResetError('');
                setResetInfo('');
              }}
              className="mt-6 pt-5 border-t border-admin-border-subtle w-full text-center text-xs font-bold text-admin-muted hover:text-admin-text transition-colors"
            >
              ← Back to admin sign in
            </button>
          </>
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
                <div className="relative">
                  <input
                    id="pin"
                    type={showPin ? 'text' : 'password'}
                    autoComplete="current-password"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label="Show/Hide PIN"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-[#0066ff] hover:bg-gray-100 transition-colors"
                  >
                    {!showPin ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    )}
                  </button>
                </div>
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

            <div className="mt-6 pt-5 border-t border-admin-border-subtle space-y-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setResetMode(true);
                  setError('');
                  setResetError('');
                  setResetInfo('');
                }}
                className="w-full text-xs font-bold text-admin-muted hover:text-admin-text transition-colors"
              >
                Forgot your PIN? Reset it here
              </button>
              <Link
                href="/"
                className="block text-xs font-bold text-admin-muted hover:text-admin-text transition-colors"
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

