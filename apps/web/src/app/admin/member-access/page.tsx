'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  adminAPI,
  APIError,
  AdminCustomer,
  PendingMembership,
} from '@/app/services/api';
import { StatusBadge, roleBadge, activeBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { SkeletonTable, EmptyState, ErrorState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

type Role = 'participant' | 'host' | 'admin';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function money(n: number | string) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function kycBadge(status: AdminCustomer['verification_status']) {
  switch (status) {
    case 'verified':
      return { tone: 'success' as BadgeTone, label: 'Verified' };
    case 'rejected':
      return { tone: 'danger' as BadgeTone, label: 'Rejected' };
    default:
      return { tone: 'warning' as BadgeTone, label: 'Pending' };
  }
}

// ── Reset PIN modal ──────────────────────────────────────────────────────────

function ResetPinModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: AdminCustomer | null;
  onClose: () => void;
  onSuccess: (customer: AdminCustomer) => void;
}) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!customer) return null;

  const fullName = `${customer.first_name} ${customer.last_name}`.trim() || customer.phone;

  const close = () => {
    if (busy) return;
    setPin('');
    setConfirm('');
    setError(null);
    setDone(false);
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError('Enter a new 4-digit PIN.');
      return;
    }
    if (pin !== confirm) {
      setError('PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      await adminAPI.resetUserPin(customer.id, pin);
      setDone(true);
      setTimeout(() => onSuccess(customer), 900);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Failed to reset the PIN.';
      setError(message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-admin-card rounded-card border border-admin-border shadow-xl p-6">
        <h2 className="text-lg font-extrabold text-admin-text">Reset PIN</h2>
        <p className="mt-1 text-sm text-admin-muted">
          Set a new 4-digit PIN for <span className="font-bold text-admin-text">{fullName}</span>. Their account will be
          unlocked immediately.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-admin-muted mb-1" htmlFor="member-access-pin">
              New PIN
            </label>
            <input
              id="member-access-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full py-2.5 px-3 rounded-lg bg-admin-elevated border border-admin-border text-sm text-admin-text text-center tracking-widest placeholder:text-admin-disabled focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-admin-muted mb-1" htmlFor="member-access-pin-confirm">
              Confirm new PIN
            </label>
            <input
              id="member-access-pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full py-2.5 px-3 rounded-lg bg-admin-elevated border border-admin-border text-sm text-admin-text text-center tracking-widest placeholder:text-admin-disabled focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-semibold text-danger-600">{error}</p>}
        {done && <p className="mt-3 text-sm font-semibold text-success-600">PIN updated and account unlocked.</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || done}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-sm font-bold text-[#00d9ff] hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Resetting…' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change role modal ─────────────────────────────────────────────────────────

function RoleModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: AdminCustomer | null;
  onClose: () => void;
  onSuccess: (customer: AdminCustomer, role: Role) => void;
}) {
  const [role, setRole] = useState<Role>(() => customer?.role ?? 'participant');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!customer) return null;

  const fullName = `${customer.first_name} ${customer.last_name}`.trim() || customer.phone;

  const close = () => {
    if (busy) return;
    setRole('participant');
    setError(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await adminAPI.updateUserRole(customer.id, role);
      setTimeout(() => onSuccess(customer, role), 600);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Failed to update the role.';
      setError(message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-admin-card rounded-card border border-admin-border shadow-xl p-6">
        <h2 className="text-lg font-extrabold text-admin-text">Change access role</h2>
        <p className="mt-1 text-sm text-admin-muted">
          Grant or revoke access for <span className="font-bold text-admin-text">{fullName}</span>. Choosing{' '}
          <span className="font-bold text-admin-text">Admin</span> gives them the admin console and dashboard.
        </p>

        <div className="mt-4">
          <label className="block text-xs font-bold uppercase tracking-wide text-admin-muted mb-1" htmlFor="member-access-role">
            Role
          </label>
          <select
            id="member-access-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full py-2.5 px-3 rounded-lg bg-admin-elevated border border-admin-border text-sm text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          >
            <option value="participant">Member</option>
            <option value="host">Host</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {role === 'admin' && (
          <div className="mt-3 rounded-lg border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-sm font-semibold text-warning-700">
            {fullName} will get full admin access to the website console.
          </div>
        )}
        {role !== 'admin' && customer.role === 'admin' && (
          <div className="mt-3 rounded-lg border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-sm font-semibold text-warning-700">
            {fullName} will lose admin console access.
          </div>
        )}

        {error && <p className="mt-3 text-sm font-semibold text-danger-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || role === customer.role}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-sm font-bold text-[#00d9ff] hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Saving…' : role === 'admin' ? 'Make admin' : 'Update role'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMemberAccessPage() {
  const [memberships, setMemberships] = useState<PendingMembership[]>([]);
  const [members, setMembers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<AdminCustomer | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminCustomer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mems, users] = await Promise.all([
        adminAPI.listPendingMemberships(),
        adminAPI.listUsers({ page: 1, limit: 100 }),
      ]);
      setMemberships(mems);
      setMembers(users.items);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load member access data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const act = async (id: string, action: () => Promise<unknown>, successText: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      await action();
      setNotice(successText);
      await load();
    } catch (err) {
      const text =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Action failed.';
      setNotice(text);
    } finally {
      setBusyId(null);
    }
  };

  const handleRoleSuccess = (customer: AdminCustomer, newRole: Role) => {
    setRoleTarget(null);
    setMembers((prev) => prev.map((c) => (c.id === customer.id ? { ...c, role: newRole } : c)));
    setNotice(`${customer.first_name} ${customer.last_name}'s role was changed to ${newRole}.`);
  };

  const handleResetSuccess = (customer: AdminCustomer) => {
    setResetTarget(null);
    setNotice(`Reset PIN for ${customer.first_name} ${customer.last_name} was successful.`);
  };

  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  return (
    <>
      {notice && (
        <div className="rounded-lg border border-success-500/25 bg-success-500/10 px-4 py-3 text-sm font-semibold text-success-600">
          {notice}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={8} columns={5} variant="dark" />
      ) : error ? (
        <ErrorState
          title={
            error === 'Request failed with status 401' || error === 'Request failed with status 403'
              ? 'Not authorized'
              : 'Something went wrong'
          }
          description={
            error === 'Request failed with status 401' || error === 'Request failed with status 403'
              ? 'You need an admin session to view this page. Sign in with an admin account and try again.'
              : 'We could not load member access data. Please try again.'
          }
          onRetry={() => void load()}
          variant="dark"
        />
      ) : (
        <>
          {/* ── Pending join requests ─────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-extrabold text-admin-text mb-3">
              Pending Join Requests {memberships.length > 0 && `(${memberships.length})`}
            </h2>
            {memberships.length === 0 ? (
              <EmptyState
                title="No pending join requests"
                description="When members request to join an Equb, their requests will appear here for approval."
                variant="dark"
              />
            ) : (
              <div className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
                <div className="divide-y divide-admin-border-subtle">
                  {memberships.map((m) => (
                    <div key={m.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-admin-text">
                            {m.user_first_name} {m.user_last_name}
                          </p>
                          <StatusBadge tone="warning" variant="dark">pending</StatusBadge>
                        </div>
                        <p className="mt-1 text-xs text-admin-muted">
                          {m.user_phone} · {m.user_email || 'no email'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-admin-muted">
                          <span>
                            Equb: <strong className="text-admin-text">{m.equb_name}</strong>
                          </span>
                          <span>
                            Contribution: <strong className="text-admin-text">ETB {money(m.equb_contribution)}</strong>
                          </span>
                          <span>Requested {formatDate(m.joined_at)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => act(m.id, () => adminAPI.approveMembership(m.id), 'Join request approved.')}
                          disabled={busyId !== null}
                          className="px-4 py-2 rounded-lg bg-success-600 text-[#00d9ff] text-sm font-bold hover:bg-success-500 disabled:opacity-50 transition-colors"
                        >
                          {busyId === m.id ? 'Working…' : '✅ Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => act(m.id, () => adminAPI.rejectMembership(m.id), 'Join request rejected.')}
                          disabled={busyId !== null}
                          className="px-4 py-2 rounded-lg border border-danger-500/40 text-danger-500 text-sm font-bold hover:bg-danger-500/10 disabled:opacity-50 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Member access table ───────────────────────────────────────── */}
          <section className="mt-8">
            <h2 className="text-base font-extrabold text-admin-text mb-3">
              Member Access ({members.length})
            </h2>
            {members.length === 0 ? (
              <EmptyState
                title="No members yet"
                description="When members register on QalNet they will appear here."
                variant="dark"
              />
            ) : (
              <div className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-admin-elevated text-left text-xs uppercase tracking-wider text-admin-muted">
                        <th className="px-5 py-3 font-bold">Member</th>
                        <th className="px-5 py-3 font-bold">Phone</th>
                        <th className="px-5 py-3 font-bold">Role</th>
                        <th className="px-5 py-3 font-bold">Access</th>
                        <th className="px-5 py-3 font-bold">KYC</th>
                        <th className="px-5 py-3 font-bold text-right">Joined</th>
                        <th className="px-5 py-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-admin-border-subtle">
                      {members.map((customer) => {
                        const roleInfo = roleBadge(customer.role);
                        const statusInfo = activeBadge(customer.is_active);
                        const kyc = kycBadge(customer.verification_status);
                        return (
                          <tr key={customer.id} className="hover:bg-admin-card-hover transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                {customer.profile_photo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={customer.profile_photo}
                                    alt={`${customer.first_name} ${customer.last_name}`}
                                    className="w-9 h-9 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                                    {initials(customer.first_name, customer.last_name)}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-admin-text">
                                    {customer.first_name} {customer.last_name}
                                  </p>
                                  {customer.telegram_handle && (
                                    <p className="text-xs text-admin-muted">@{customer.telegram_handle}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-admin-text-secondary">{customer.phone}</td>
                            <td className="px-5 py-3.5">
                              <StatusBadge tone={roleInfo.tone as BadgeTone} variant="dark">{roleInfo.label}</StatusBadge>
                            </td>
                            <td className="px-5 py-3.5">
                              <StatusBadge tone={statusInfo.tone} variant="dark">{statusInfo.label}</StatusBadge>
                            </td>
                            <td className="px-5 py-3.5">
                              <StatusBadge tone={kyc.tone} variant="dark">{kyc.label}</StatusBadge>
                            </td>
                            <td className="px-5 py-3.5 text-admin-muted text-right whitespace-nowrap">
                              {formatDate(customer.created_at)}
                            </td>
                            <td className="px-5 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setRoleTarget(customer)}
                                  className="px-3 py-1.5 rounded-lg border border-admin-border text-xs font-bold text-admin-text-secondary hover:bg-brand-100 hover:text-brand-700 hover:border-brand-500/40 transition-colors"
                                >
                                  {customer.role === 'admin' ? 'Change role' : 'Make admin'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setResetTarget(customer)}
                                  className="px-3 py-1.5 rounded-lg border border-admin-border text-xs font-bold text-admin-text-secondary hover:bg-brand-100 hover:text-brand-700 hover:border-brand-500/40 transition-colors"
                                >
                                  Reset PIN
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <ResetPinModal customer={resetTarget} onClose={() => setResetTarget(null)} onSuccess={handleResetSuccess} />
      <RoleModal
        key={roleTarget?.id ?? 'none'}
        customer={roleTarget}
        onClose={() => setRoleTarget(null)}
        onSuccess={handleRoleSuccess}
      />
    </>
  );
}
