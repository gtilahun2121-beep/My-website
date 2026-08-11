'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminAPI, APIError, AdminCustomer, AdminCustomerListResponse, ListUsersParams } from '@/app/services/api';
import KpiCard from '@/app/components/admin/KpiCard';
import { StatusBadge, roleBadge, activeBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { SkeletonTable, EmptyState, ErrorState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const kpiIcon = (path: string, viewBox = '0 0 24 24') => (
  <svg viewBox={viewBox} className="w-5 h-5" {...stroke}>
    <path d={path} />
  </svg>
);

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

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All roles' },
  { value: 'participant', label: 'Member' },
  { value: 'host', label: 'Host' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
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
            <label
              className="block text-xs font-bold uppercase tracking-wide text-admin-muted mb-1"
              htmlFor="reset-pin"
            >
              New PIN
            </label>
            <input
              id="reset-pin"
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
            <label
              className="block text-xs font-bold uppercase tracking-wide text-admin-muted mb-1"
              htmlFor="confirm-pin"
            >
              Confirm new PIN
            </label>
            <input
              id="confirm-pin"
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
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-sm font-bold text-white hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Resetting…' : 'Reset PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleModal({
  customer,
  onClose,
  onSuccess,
}: {
  customer: AdminCustomer | null;
  onClose: () => void;
  onSuccess: (customer: AdminCustomer, role: AdminCustomer['role']) => void;
}) {
  const [role, setRole] = useState<AdminCustomer['role']>(() => customer?.role ?? 'participant');
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm bg-admin-card rounded-card border border-admin-border shadow-xl p-6">
        <h2 className="text-lg font-extrabold text-admin-text">Change role</h2>
        <p className="mt-1 text-sm text-admin-muted">
          Grant or revoke access for <span className="font-bold text-admin-text">{fullName}</span>. Choosing{' '}
          <span className="font-bold text-admin-text">Admin</span> gives them the website admin console and dashboard.
        </p>

        <div className="mt-4">
          <label
            className="block text-xs font-bold uppercase tracking-wide text-admin-muted mb-1"
            htmlFor="role-select"
          >
            Role
          </label>
          <select
            id="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminCustomer['role'])}
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
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-sm font-bold text-white hover:from-brand-500 hover:to-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? 'Saving…' : role === 'admin' ? 'Make admin' : 'Update role'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RegisteredCustomersPage() {
  const [data, setData] = useState<AdminCustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<AdminCustomer | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminCustomer | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeRef.current) clearTimeout(noticeRef.current);
    noticeRef.current = setTimeout(() => setNotice(null), 4000);
  };

  const handleResetSuccess = (customer: AdminCustomer) => {
    setResetTarget(null);
    const name = `${customer.first_name} ${customer.last_name}`.trim() || customer.phone;
    showNotice(`Reset PIN for ${name} was successful. Their account has been unlocked.`);
  };

  const handleRoleSuccess = (customer: AdminCustomer, newRole: AdminCustomer['role']) => {
    setRoleTarget(null);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((c) => (c.id === customer.id ? { ...c, role: newRole } : c)),
      };
    });
    const name = `${customer.first_name} ${customer.last_name}`.trim() || customer.phone;
    showNotice(
      newRole === 'admin'
        ? `${name} is now a website admin and can access the admin console.`
        : `${name}'s role was changed to ${newRole === 'host' ? 'Host' : 'Member'}.`,
    );
  };

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const filters = (p: number): ListUsersParams => ({
    page: p,
    limit,
    search: search.trim() || undefined,
    role: (role || undefined) as ListUsersParams['role'],
    status: (status || undefined) as ListUsersParams['status'],
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (params: ListUsersParams = {}) => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminAPI.listUsers(params);
        setData(res);
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.data?.message || err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load customers.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced search + filters → refetch from page 1
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void load(filters(1));
    }, search ? 400 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, status, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const summary = data?.summary;

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    void load(filters(p));
  };

  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  return (
    <>
      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Members"
          value={loading && !summary ? '—' : (summary?.total ?? 0)}
          hint="All registered accounts"
          accent="brand"
          variant="dark"
          icon={kpiIcon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z')}
        />
        <KpiCard
          label="Active"
          value={loading && !summary ? '—' : (summary?.active ?? 0)}
          hint="Members with active accounts"
          accent="success"
          variant="dark"
          icon={kpiIcon('M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z')}
        />
        <KpiCard
          label="Hosts"
          value={loading && !summary ? '—' : (summary?.hosts ?? 0)}
          hint="Members running equbs"
          accent="accent"
          variant="dark"
          icon={kpiIcon('M4 21v-9m5 9v-7m5 7V4m5 17V10')}
        />
        <KpiCard
          label="New This Month"
          value={loading && !summary ? '—' : (summary?.new_this_month ?? 0)}
          hint="Registrations in the last 30 days"
          accent="warning"
          variant="dark"
          icon={kpiIcon('M3 17l6-6 4 4 7-7m0 0v5m0-5h-5')}
        />
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-admin-disabled"
            {...stroke}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, phone, email…"
            className="w-full py-2.5 pl-9 pr-3 rounded-lg bg-admin-card border border-admin-border text-sm text-admin-text placeholder:text-admin-disabled focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="py-2.5 px-3 rounded-lg bg-admin-card border border-admin-border text-sm font-semibold text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            aria-label="Filter by role"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="py-2.5 px-3 rounded-lg bg-admin-card border border-admin-border text-sm font-semibold text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            aria-label="Filter by status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Success / notice banner ─────────────────────────────────────── */}
      {notice && (
        <div
          role="status"
          className="rounded-lg border border-success-500/25 bg-success-500/10 px-4 py-3 text-sm font-semibold text-success-600"
        >
          {notice}
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {loading && !data ? (
        <SkeletonTable rows={8} columns={5} variant="dark" />
      ) : error ? (
        <ErrorState
          title={error === 'Request failed with status 401' || error === 'Request failed with status 403' ? 'Not authorized' : 'Something went wrong'}
          description={
            error === 'Request failed with status 401' || error === 'Request failed with status 403'
              ? 'You need an admin session to view this page. Sign in with an admin account and try again.'
              : 'We could not load the customer list. Please try again.'
          }
          onRetry={() => void load(filters(page))}
          variant="dark"
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={search || role || status ? 'No matching customers' : 'No customers yet'}
          description={
            search || role || status
              ? 'Try adjusting your search or clearing the filters.'
              : 'When members register on QalNet they will appear here.'
          }
          variant="dark"
        />
      ) : (
        <>
          <div className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-admin-elevated text-left text-xs uppercase tracking-wider text-admin-muted">
                    <th className="px-5 py-3 font-bold">Member</th>
                    <th className="px-5 py-3 font-bold">Phone</th>
                    <th className="px-5 py-3 font-bold">Email</th>
                    <th className="px-5 py-3 font-bold">Role</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 font-bold text-right">Registered</th>
                    <th className="px-5 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border-subtle">
                  {data.items.map((customer) => {
                    const roleInfo = roleBadge(customer.role);
                    const statusInfo = activeBadge(customer.is_active);
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
                        <td className="px-5 py-3.5 text-admin-text-secondary">{customer.email || '—'}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge tone={roleInfo.tone as BadgeTone} variant="dark">{roleInfo.label}</StatusBadge>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge tone={statusInfo.tone} variant="dark">{statusInfo.label}</StatusBadge>
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

          {/* ── Pagination ─────────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-admin-muted">
              Showing{' '}
              <span className="font-bold text-admin-text">
                {data.total === 0 ? 0 : (data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)}
              </span>{' '}
              of <span className="font-bold text-admin-text">{data.total}</span> members
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm font-bold text-admin-text">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-2 rounded-lg bg-admin-card border border-admin-border text-sm font-bold text-admin-text-secondary hover:bg-admin-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
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
