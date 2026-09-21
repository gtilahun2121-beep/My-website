'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/app/components/admin/AppShell';
import { useAuth } from '@/app/context/AuthContext';
import { authAPI } from '@/app/services/api';
import { languages, defaultLanguage, type Language } from '@/i18n/config';
import { initials, roleLabel } from '@/app/components/dashboard/format';

type SectionId = 'profile' | 'notifications' | 'language' | 'security' | 'help';

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-4 7c-4.4 0-8 2.4-8 5.3V21h16v-1.7C20 16.4 16.4 14 12 14Z" />
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: 'language',
    label: 'Language',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a15 15 0 0 1-4-10 15 15 0 0 1 4-10 15 15 0 0 1 4 10 15 15 0 0 1-4 10ZM3.5 9h17m-17 6h17" />
      </svg>
    ),
  },
  {
    id: 'security',
    label: 'Security & Privacy',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l8 4v6c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V7l8-4Z" />
      </svg>
    ),
  },
  {
    id: 'help',
    label: 'Help & Support',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13a2.2 2.2 0 1 1 3.1 2c-1 .6-3.1 1.6-3.1 4m.01 3h.01" />
      </svg>
    ),
  },
];

const LANG_KEY = 'qalnet_lang';
const NOTIF_KEY = 'qalnet_notif_prefs';

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-bold text-[#0066ff]">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-brand-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [section, setSection] = useState<SectionId>('profile');

  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [notifPrefs, setNotifPrefs] = useState({
    telegram: true,
    sms: false,
    push: true,
    in_app: true,
  });

  // ── Two-factor authentication state ─────────────────────────────────────
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [tfaBackupCount, setTfaBackupCount] = useState(0);
  const [tfaLoading, setTfaLoading] = useState(true);
  const [tfaStep, setTfaStep] = useState<'idle' | 'setup' | 'verify-disable'>('idle');
  const [tfaSecret, setTfaSecret] = useState('');
  const [tfaOtpauthUrl, setTfaOtpauthUrl] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const [tfaBackupCodes, setTfaBackupCodes] = useState<string[]>([]);
  const [tfaBusy, setTfaBusy] = useState(false);
  const [tfaError, setTfaError] = useState('');
  const [tfaInfo, setTfaInfo] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLang = localStorage.getItem(LANG_KEY);
    if (storedLang && (languages as Record<string, string>)[storedLang]) {
      const code = storedLang as Language;
      queueMicrotask(() => setLang(code));
    }
    try {
      const stored = localStorage.getItem(NOTIF_KEY);
      if (stored) {
        const prefs = JSON.parse(stored) as Partial<typeof notifPrefs>;
        queueMicrotask(() => setNotifPrefs((prev) => ({ ...prev, ...prefs })));
      }
    } catch {
      // ignore malformed prefs
    }
  }, []);

  // Load the real 2FA status once the user is authenticated.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    let cancelled = false;
    authAPI
      .get2FAStatus()
      .then((status) => {
        if (cancelled) return;
        setTfaEnabled(status.enabled);
        setTfaBackupCount(status.backup_codes_count);
      })
      .catch(() => {
        if (!cancelled) setTfaEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setTfaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  if (isLoading) {
    return (
      <div className="dark-navy min-h-screen flex items-center justify-center bg-surface">
        <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  const changeLang = (next: Language) => {
    setLang(next);
    localStorage.setItem(LANG_KEY, next);
  };

  const setNotif = (key: keyof typeof notifPrefs, value: boolean) => {
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
  };

  // ── 2FA handlers ─────────────────────────────────────────────────────────

  const start2FASetup = async () => {
    setTfaBusy(true);
    setTfaError('');
    setTfaInfo('');
    try {
      const setup = await authAPI.setup2FA();
      setTfaSecret(setup.secret);
      setTfaOtpauthUrl(setup.otpauth_url);
      setTfaCode('');
      setTfaStep('setup');
    } catch (e) {
      setTfaError(e instanceof Error ? e.message : 'Could not start 2FA setup.');
    } finally {
      setTfaBusy(false);
    }
  };

  const confirm2FASetup = async () => {
    setTfaBusy(true);
    setTfaError('');
    const code = tfaCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setTfaError('Enter the 6-digit code from your authenticator app.');
      setTfaBusy(false);
      return;
    }
    try {
      const result = await authAPI.verify2FASetup(code);
      setTfaEnabled(result.enabled);
      setTfaBackupCodes(result.backup_codes);
      setTfaBackupCount(result.backup_codes.length);
      setTfaStep('idle');
      setTfaInfo('Two-factor authentication is now enabled. Save your backup codes below.');
    } catch (e) {
      setTfaError(e instanceof Error ? e.message : 'Invalid code.');
    } finally {
      setTfaBusy(false);
    }
  };

  const start2FADisable = () => {
    setTfaCode('');
    setTfaError('');
    setTfaInfo('');
    setTfaStep('verify-disable');
  };

  const confirm2FADisable = async () => {
    setTfaBusy(true);
    setTfaError('');
    const code = tfaCode.trim();
    if (code.length < 6 || code.length > 20) {
      setTfaError('Enter a valid code from your authenticator app, or a backup code.');
      setTfaBusy(false);
      return;
    }
    try {
      const result = await authAPI.disable2FA(code);
      setTfaEnabled(result.enabled);
      setTfaBackupCount(0);
      setTfaBackupCodes([]);
      setTfaStep('idle');
      setTfaInfo('Two-factor authentication has been disabled.');
    } catch (e) {
      setTfaError(e instanceof Error ? e.message : 'Invalid code.');
    } finally {
      setTfaBusy(false);
    }
  };

  const cancel2FA = () => {
    setTfaStep('idle');
    setTfaCode('');
    setTfaError('');
    setTfaInfo('');
  };

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(tfaBackupCodes.join('\n'));
      setTfaInfo('Backup codes copied to clipboard.');
    } catch {
      setTfaInfo('Copy the codes below and store them somewhere safe.');
    }
  };

  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'QalNet Member';

  return (
    <AppShell title="Settings" subtitle="Customise your QalNet experience" variant="member">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Category rail ───────────────────────────────────────────── */}
        <nav className="lg:col-span-1 bg-card rounded-card border border-gray-200 p-2 h-fit" aria-label="Settings sections">
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-brand-100 text-[#0042ad]' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className={active ? 'text-brand-600' : 'text-gray-400'}>{s.icon}</span>
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* ── Active section ───────────────────────────────────────────── */}
        <div className="lg:col-span-3">
          {section === 'profile' && (
            <div className="bg-card rounded-card border border-gray-200 p-6">
              <h2 className="text-lg font-black text-[#0066ff]">Profile</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                View and manage your account identity.
              </p>

              <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                {user.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profilePhoto}
                    alt={fullName}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-accent-600 text-white flex items-center justify-center text-lg font-black shrink-0">
                    {initials(user.firstName, user.lastName)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#0066ff]">{fullName}</p>
                  <p className="text-xs text-gray-500 capitalize">{roleLabel(user.role)}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {user.phoneNumber || user.email || '—'}
                  </p>
                </div>
                <Link
                  href="/profile"
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors shrink-0"
                >
                  View full profile
                </Link>
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="bg-card rounded-card border border-gray-200 p-6">
              <h2 className="text-lg font-black text-[#0066ff]">Notifications</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Choose how QalNet reaches you about payments, payouts, and group activity.
              </p>

              <div className="mt-4 divide-y divide-slate-100">
                <Toggle
                  label="Telegram"
                  description="Messages sent to your linked Telegram chat"
                  checked={notifPrefs.telegram}
                  onChange={(v) => setNotif('telegram', v)}
                />
                <Toggle
                  label="SMS"
                  description="Text messages to your phone number"
                  checked={notifPrefs.sms}
                  onChange={(v) => setNotif('sms', v)}
                />
                <Toggle
                  label="Push notifications"
                  description="Browser and mobile push alerts"
                  checked={notifPrefs.push}
                  onChange={(v) => setNotif('push', v)}
                />
                <Toggle
                  label="In-app"
                  description="Alerts shown inside the QalNet app"
                  checked={notifPrefs.in_app}
                  onChange={(v) => setNotif('in_app', v)}
                />
              </div>

              <p className="mt-4 text-xs text-gray-400">
                Your preferences are saved on this device.
              </p>
            </div>
          )}

          {section === 'language' && (
            <div className="bg-card rounded-card border border-gray-200 p-6">
              <h2 className="text-lg font-black text-[#0066ff]">Language</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Choose your preferred display language.
              </p>

              <div className="mt-5 space-y-2">
                {(Object.keys(languages) as Language[]).map((code) => {
                  const active = lang === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => changeLang(code)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-colors ${
                        active
                          ? 'border-brand-500 bg-brand-50 text-[#0042ad]'
                          : 'border-gray-200 text-white hover:bg-gray-50'
                      }`}
                    >
                      <span>{languages[code]}</span>
                      {active && (
                        <svg viewBox="0 0 24 24" className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m5 13 4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {section === 'security' && (
            <div className="bg-card rounded-card border border-gray-200 p-6">
              <h2 className="text-lg font-black text-[#0066ff]">Security &amp; Privacy</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Keep your account secure.
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <p className="text-sm font-bold text-[#0066ff]">Change PIN</p>
                    <p className="text-xs text-gray-500">Reset your 6-digit login PIN via SMS OTP</p>
                  </div>
                  <Link
                    href="/profile"
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-[#0066ff] hover:bg-gray-100 transition-colors shrink-0"
                  >
                    Go to profile
                  </Link>
                </div>

                {/* Two-factor authentication */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-[#0066ff]">Two-factor authentication</p>
                      <p className="text-xs text-gray-500">
                        {tfaLoading
                          ? 'Checking your 2FA status…'
                          : tfaEnabled
                            ? tfaBackupCount > 0
                              ? `Enabled — ${tfaBackupCount} backup code${tfaBackupCount === 1 ? '' : 's'} remaining`
                              : 'Enabled'
                            : 'Add an extra layer of security with an authenticator app'}
                      </p>
                    </div>
                    {!tfaLoading &&
                      (tfaStep === 'idle' ? (
                        tfaEnabled ? (
                          <button
                            type="button"
                            onClick={() => void start2FADisable()}
                            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-[#0066ff] hover:bg-gray-100 transition-colors shrink-0"
                          >
                            Disable
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void start2FASetup()}
                            disabled={tfaBusy}
                            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
                          >
                            {tfaBusy ? 'Preparing…' : 'Enable'}
                          </button>
                        )
                      ) : null)}
                  </div>

                  {/* Setup / disable panels */}
                  {tfaStep === 'setup' && (
                    <div className="mt-4 rounded-xl border border-brand-200 bg-white p-4 space-y-3">
                      <p className="text-xs font-bold text-[#0066ff]">
                        Step 1 — Scan or enter this secret in your authenticator app (Google Authenticator, Authy, etc.)
                      </p>
                      <div className="rounded-lg bg-gray-100 p-3 font-mono text-xs break-all text-[#0066ff]">
                        {tfaOtpauthUrl}
                      </div>
                      <p className="text-xs text-gray-500">
                        Secret key: <span className="font-mono font-bold text-[#0066ff]">{tfaSecret}</span>
                      </p>

                      <p className="text-xs font-bold text-[#0066ff]">Step 2 — Enter the 6-digit code shown by the app</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={tfaCode}
                        onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-500 focus:outline-none text-center text-2xl tracking-widest font-bold"
                      />

                      {tfaError && <p className="text-xs font-semibold text-danger-600">{tfaError}</p>}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void confirm2FASetup()}
                          disabled={tfaBusy || !/^\d{6}$/.test(tfaCode)}
                          className="flex-1 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 transition-colors"
                        >
                          {tfaBusy ? 'Verifying…' : 'Verify & Enable'}
                        </button>
                        <button
                          type="button"
                          onClick={cancel2FA}
                          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-[#0066ff] hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {tfaStep === 'verify-disable' && (
                    <div className="mt-4 rounded-xl border border-danger-200 bg-white p-4 space-y-3">
                      <p className="text-xs font-bold text-[#0066ff]">
                        Enter a current code from your authenticator app (or a backup code) to disable 2FA.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={tfaCode}
                        onChange={(e) => setTfaCode(e.target.value.replace(/[^A-Za-z0-9-]/g, '').slice(0, 20))}
                        placeholder="000000"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-brand-500 focus:outline-none text-center text-2xl tracking-widest font-bold"
                      />

                      {tfaError && <p className="text-xs font-semibold text-danger-600">{tfaError}</p>}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void confirm2FADisable()}
                          disabled={tfaBusy}
                          className="flex-1 px-4 py-2 rounded-lg bg-danger-600 text-[#0066ff] text-sm font-bold hover:bg-danger-700 disabled:opacity-50 transition-colors"
                        >
                          {tfaBusy ? 'Disabling…' : 'Disable 2FA'}
                        </button>
                        <button
                          type="button"
                          onClick={cancel2FA}
                          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-[#0066ff] hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {tfaInfo && <p className="mt-3 text-xs font-semibold text-success-600">{tfaInfo}</p>}

                  {tfaBackupCodes.length > 0 && (
                    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-[#0042ad]">Your one-time backup codes</p>
                        <button
                          type="button"
                          onClick={() => void copyBackupCodes()}
                          className="text-xs font-bold text-brand-700 hover:underline"
                        >
                          Copy all
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-brand-700">
                        Store these somewhere safe. Each code works only once and can sign you in if you lose your device.
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {tfaBackupCodes.map((code) => (
                          <code key={code} className="rounded bg-white px-2 py-1.5 text-center text-xs font-mono font-bold text-[#0066ff] border border-brand-200">
                            {code}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 opacity-60">
                  <div>
                    <p className="text-sm font-bold text-[#0066ff]">Login alerts</p>
                    <p className="text-xs text-gray-500">Notify me when a new device signs in</p>
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Coming soon</span>
                </div>
              </div>
            </div>
          )}

          {section === 'help' && (
            <div className="bg-card rounded-card border border-gray-200 p-6">
              <h2 className="text-lg font-black text-[#0066ff]">Help &amp; Support</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Find answers and get in touch with our team.
              </p>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href="/security"
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:border-brand-300 transition-colors"
                >
                  <p className="text-sm font-bold text-[#0066ff]">Help Center</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Guides on Equbs, payments, and trust scores.
                  </p>
                </Link>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left cursor-not-allowed opacity-60"
                >
                  <p className="text-sm font-bold text-[#0066ff]">Live Chat</p>
                  <p className="mt-0.5 text-xs text-gray-500">Chat with a support agent.</p>
                </button>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-left cursor-not-allowed opacity-60"
                >
                  <p className="text-sm font-bold text-[#0066ff]">Report an Issue</p>
                  <p className="mt-0.5 text-xs text-gray-500">Flag a problem with your account.</p>
                </button>
                <div className="rounded-xl bg-gradient-to-br from-brand-700 to-brand-600 text-white p-4">
                  <p className="text-sm font-bold">Contact Support</p>
                  <p className="mt-0.5 text-xs text-brand-100">
                    Our team typically replies within 24 hours.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
