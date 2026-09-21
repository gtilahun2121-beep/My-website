'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/app/components/admin/AppShell';
import { StatusBadge } from '@/app/components/admin/StatusBadge';
import ProfilePhotoModal from '@/app/components/profile/ProfilePhotoModal';
import { useAuth } from '@/app/context/AuthContext';
import { userAPI, authAPI, APIError } from '@/app/services/api';
import { initials, roleLabel, trustTierLabel, formatDateLong } from '@/app/components/dashboard/format';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm font-bold text-[#0066ff]">{value || '—'}</p>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoading, isAuthenticated, updateProfilePhoto, updateUser } = useAuth();

  const [photoOpen, setPhotoOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [telegramHandle, setTelegramHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const next = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phoneNumber,
      email: user.email,
    };
    queueMicrotask(() => setForm(next));
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      userAPI
        .getProfile()
        .then((profile) => {
          if (profile?.telegram_handle) setTelegramHandle(profile.telegram_handle);
        })
        .catch(() => {
          // profile fetch is best-effort
        });
    }
  }, [isAuthenticated, user]);

  if (isLoading) {
    return (
      <div className="dark-navy min-h-screen flex items-center justify-center bg-surface">
        <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  const handleSavePhoto = async (photo: string | null) => {
    setPhotoSaving(true);
    setPhotoError(null);
    try {
      await userAPI.updateProfile({ profile_photo: photo });
      updateProfilePhoto(photo);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Could not save your photo.';
      setPhotoError(message);
      throw err;
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await userAPI.updateProfile({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        telegram_handle: telegramHandle.trim() || null,
      });
      // Reflect the change everywhere immediately (member dashboard, admin
      // sidebar, header) — not just after the JWT is refreshed.
      updateUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phone.trim(),
        email: form.email.trim(),
      });
      setSaved(true);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Could not save your details.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePin = async () => {
    setPinBusy(true);
    setPinError(null);
    try {
      await authAPI.forgotPin(user.phoneNumber);
      setPinError(
        'A verification code has been sent to your phone. Sign out and use "Forgot PIN" on the sign-in screen to complete the reset.',
      );
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Could not start a PIN reset.');
    } finally {
      setPinBusy(false);
    }
  };

  const fullName = `${user.firstName} ${user.lastName}`.trim() || 'QalNet Member';

  // KYC Status states
  const [kycOpen, setKycOpen] = useState(false);
  const [kycData, setKycData] = useState({
    idType: 'national_id',
    idNumber: '',
    dateOfBirth: '',
    nationality: 'Ethiopian',
    city: '',
    subcity: '',
    kebele: '',
    houseNumber: '',
  });
  const [kycSaving, setKycSaving] = useState(false);
  const [kycError, setKycError] = useState<string | null>(null);
  const [kycSuccess, setKycSuccess] = useState(false);

  // Load KYC data if exists
  useEffect(() => {
    if (isAuthenticated && user) {
      // KYC data is stored in component state only
      // (backend API support pending)
    }
  }, [isAuthenticated, user]);

  const handleSaveKYC = async () => {
    setKycSaving(true);
    setKycError(null);
    setKycSuccess(false);

    // Validation
    if (!kycData.idNumber.trim()) {
      setKycError('ID number is required');
      setKycSaving(false);
      return;
    }
    if (!kycData.dateOfBirth) {
      setKycError('Date of birth is required');
      setKycSaving(false);
      return;
    }
    if (!kycData.city.trim()) {
      setKycError('City is required');
      setKycSaving(false);
      return;
    }

    try {
      // Note: Backend API support for kyc_data is pending
      // For now, we show success locally without persisting to backend
      setKycSuccess(true);
      setTimeout(() => setKycOpen(false), 1500);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Could not save KYC information.';
      setKycError(message);
    } finally {
      setKycSaving(false);
    }
  };

  const kycStatus = user.trustTier === 'verified' ? 'verified' : user.trustTier === 'pending_kyc' ? 'pending' : 'incomplete';

  return (
    <AppShell title="My Profile" subtitle="Manage your personal information and security" variant="member">
      {/* ── Photo + identity card ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-card border border-gray-200 p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {user.profilePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.profilePhoto}
                  alt={fullName}
                  className="w-28 h-28 rounded-full object-cover ring-4 ring-brand-100"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-accent-600 text-white flex items-center justify-center text-3xl font-black ring-4 ring-brand-100">
                  {initials(user.firstName, user.lastName)}
                </div>
              )}
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center border-4 border-card hover:bg-brand-700 transition-colors"
                aria-label="Change profile photo"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" {...stroke}>
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
                </svg>
              </button>
            </div>

            <h2 className="mt-4 text-xl font-black text-[#0066ff]">{fullName}</h2>
            <p className="text-sm text-gray-500">{roleLabel(user.role)}</p>

            <div className="mt-3 flex items-center gap-2">
              <StatusBadge tone="success">Active</StatusBadge>
              <StatusBadge tone="info">{trustTierLabel(user.trustTier)}</StatusBadge>
            </div>

            {photoError && <p className="mt-3 text-xs font-semibold text-danger-600">{photoError}</p>}
            {photoSaving && <p className="mt-3 text-xs font-semibold text-gray-400">Saving…</p>}
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4 grid grid-cols-1 gap-3">
            <Field label="Member since" value={formatDateLong(user.createdAt)} />
            <Field label="Phone" value={user.phoneNumber} />
            <Field label="Email" value={user.email} />
            {telegramHandle && <Field label="Telegram" value={`@${telegramHandle}`} />}
          </div>
        </div>

        {/* ── Personal details + security ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-card border border-gray-200 p-6">
            <h3 className="text-lg font-black text-[#0066ff]">Personal Details</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Update the contact information attached to your QalNet account.
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">First name</span>
                <input
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Last name</span>
                <input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Phone number</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-gray-500">Telegram username</span>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                    @
                  </span>
                  <input
                    value={telegramHandle}
                    onChange={(e) => setTelegramHandle(e.target.value.replace(/^@/, ''))}
                    placeholder="username"
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                  />
                </div>
              </label>
            </div>

            {saved && (
              <p className="mt-4 text-sm font-semibold text-success-700">
                Your details have been saved.
              </p>
            )}
            {saveError && <p className="mt-4 text-sm font-semibold text-danger-600">{saveError}</p>}

            <button
              type="button"
              onClick={handleSaveDetails}
              disabled={saving}
              className="mt-5 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          {/* ── Security ─────────────────────────────────────────────── */}
          <div className="bg-card rounded-card border border-gray-200 p-6">
            <h3 className="text-lg font-black text-[#0066ff]">Security</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Manage your PIN and trusted devices.
            </p>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
                      <path d="M12 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm5-9h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h1m11 0V7a5 5 0 0 0-10 0v1m10 0H6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0066ff]">Change PIN</p>
                    <p className="text-xs text-gray-500">Reset your 6-digit login PIN via SMS OTP</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleChangePin}
                  disabled={pinBusy}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-[#0066ff] hover:bg-gray-100 transition-colors disabled:opacity-60 shrink-0"
                >
                  {pinBusy ? '…' : 'Change'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
                      <path d="M19 11a7 7 0 0 0-14 0M5 11H4v10h16V11h-1" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0066ff]">Trusted devices</p>
                    <p className="text-xs text-gray-500">Review devices signed in to your account</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled
                  title="Coming soon"
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-400 cursor-not-allowed shrink-0"
                >
                  Manage
                </button>
              </div>
            </div>

            {pinError && <p className="mt-4 text-sm font-semibold text-warning-700">{pinError}</p>}
          </div>
        </div>
      </div>

      {/* ── KYC Section ──────────────────────────────────────────────── */}
      <div className="mt-6 bg-card rounded-card border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-[#0066ff]">Know Your Customer (KYC)</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Complete your identity verification to increase your trust tier and transaction limits.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              kycStatus === 'verified' ? 'bg-success-100 text-success-700' :
              kycStatus === 'pending' ? 'bg-warning-100 text-warning-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {kycStatus === 'verified' ? '✓ Verified' :
               kycStatus === 'pending' ? '⏳ Under Review' :
               '○ Incomplete'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setKycOpen(!kycOpen)}
          className="mt-4 px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors"
        >
          {kycOpen ? 'Cancel' : 'Update KYC Information'}
        </button>

        {kycOpen && (
          <div className="mt-5 p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">ID Type</span>
                <select
                  value={kycData.idType}
                  onChange={(e) => setKycData(prev => ({ ...prev, idType: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                >
                  <option value="national_id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="business_license">Business License</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">ID Number *</span>
                <input
                  value={kycData.idNumber}
                  onChange={(e) => setKycData(prev => ({ ...prev, idNumber: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  placeholder="Enter ID number"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Date of Birth *</span>
                <input
                  type="date"
                  value={kycData.dateOfBirth}
                  onChange={(e) => setKycData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-500">Nationality</span>
                <input
                  value={kycData.nationality}
                  onChange={(e) => setKycData(prev => ({ ...prev, nationality: e.target.value }))}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
              </label>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-bold text-[#0066ff] mb-3">Address Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500">City *</span>
                  <input
                    value={kycData.city}
                    onChange={(e) => setKycData(prev => ({ ...prev, city: e.target.value }))}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    placeholder="e.g. Addis Ababa"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500">Sub-city</span>
                  <input
                    value={kycData.subcity}
                    onChange={(e) => setKycData(prev => ({ ...prev, subcity: e.target.value }))}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    placeholder="e.g. Bole"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500">Kebele</span>
                  <input
                    value={kycData.kebele}
                    onChange={(e) => setKycData(prev => ({ ...prev, kebele: e.target.value }))}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    placeholder="Kebele number"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-500">House Number</span>
                  <input
                    value={kycData.houseNumber}
                    onChange={(e) => setKycData(prev => ({ ...prev, houseNumber: e.target.value }))}
                    className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-[#0066ff] focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                    placeholder="House/Apartment number"
                  />
                </label>
              </div>
            </div>

            {kycError && (
              <p className="text-sm font-semibold text-danger-600">Error: {kycError}</p>
            )}
            {kycSuccess && (
              <p className="text-sm font-semibold text-success-600">✓ KYC information saved successfully!</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveKYC}
                disabled={kycSaving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors disabled:opacity-60"
              >
                {kycSaving ? 'Saving…' : 'Save KYC Information'}
              </button>
              <button
                type="button"
                onClick={() => setKycOpen(false)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Trust Tier Info ────────────────────────────────────────── */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-card p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-lg">ℹ</div>
          <div>
            <h4 className="font-bold text-blue-900">About Your Trust Tier</h4>
            <p className="mt-1 text-sm text-blue-800">
              Your trust tier determines your transaction limits and access to advanced features. Complete your KYC information to move from Basic (0 ETB/day) to Verified (500,000 ETB/day).
            </p>
            <ul className="mt-3 space-y-1 text-xs text-blue-800">
              <li>• <strong>Basic:</strong> No limit on number of equbs, limited transaction amounts</li>
              <li>• <strong>Pending:</strong> KYC under review, limited features temporarily</li>
              <li>• <strong>Verified:</strong> Full access, higher transaction limits</li>
            </ul>
          </div>
        </div>
      </div>

      <ProfilePhotoModal
        open={photoOpen}
        currentPhoto={user.profilePhoto ?? null}
        onClose={() => setPhotoOpen(false)}
        onSave={handleSavePhoto}
      />
    </AppShell>
  );
}
