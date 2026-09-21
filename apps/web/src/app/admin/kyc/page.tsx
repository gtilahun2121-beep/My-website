'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminAPI, APIError, AdminCustomer } from '@/app/services/api';
import KpiCard from '@/app/components/admin/KpiCard';
import { StatusBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { SkeletonTable, EmptyState, ErrorState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

type KycStatus = 'pending' | 'verified' | 'rejected';
type Tab = KycStatus;

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

function kycBadge(status: KycStatus) {
  switch (status) {
    case 'verified':
      return { tone: 'success' as BadgeTone, label: 'Verified' };
    case 'rejected':
      return { tone: 'danger' as BadgeTone, label: 'Rejected' };
    default:
      return { tone: 'warning' as BadgeTone, label: 'Pending' };
  }
}

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

export default function AdminKycPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [lists, setLists] = useState<Record<Tab, AdminCustomer[]>>({
    pending: [],
    verified: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pending, verified, rejected] = await Promise.all([
        adminAPI.listUsers({ page: 1, limit: 100, kyc: 'pending' }),
        adminAPI.listUsers({ page: 1, limit: 100, kyc: 'verified' }),
        adminAPI.listUsers({ page: 1, limit: 100, kyc: 'rejected' }),
      ]);
      setLists({ pending: pending.items, verified: verified.items, rejected: rejected.items });
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load KYC verification requests.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const act = async (customer: AdminCustomer, status: 'verified' | 'rejected', successText: string) => {
    setBusyId(customer.id);
    setMessage(null);
    try {
      await adminAPI.updateKycStatus(customer.id, status);
      setMessage(`${customer.first_name} ${customer.last_name}: ${successText}`);
      await load();
    } catch (err) {
      const text =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Action failed.';
      setMessage(text);
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    pending: lists.pending.length,
    verified: lists.verified.length,
    rejected: lists.rejected.length,
    total: lists.pending.length + lists.verified.length + lists.rejected.length,
  };

  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  return (
    <>
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Pending Review"
          value={loading && counts.total === 0 ? '—' : counts.pending}
          hint="Members awaiting identity verification"
          accent="warning"
          variant="dark"
          icon={kpiIcon('M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z')}
        />
        <KpiCard
          label="Verified"
          value={loading && counts.total === 0 ? '—' : counts.verified}
          hint="Identity confirmed by an admin"
          accent="success"
          variant="dark"
          icon={kpiIcon('M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z')}
        />
        <KpiCard
          label="Rejected"
          value={loading && counts.total === 0 ? '—' : counts.rejected}
          hint="Submissions declined by an admin"
          accent="danger"
          variant="dark"
          icon={kpiIcon('M18 6 6 18M6 6l12 12')}
        />
        <KpiCard
          label="Total Members"
          value={loading && counts.total === 0 ? '—' : counts.total}
          hint="Members covered by KYC review"
          accent="brand"
          variant="dark"
          icon={kpiIcon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z')}
        />
      </div>

      {/* Notice */}
      {message && (
        <div className="rounded-lg border border-brand-500/25 bg-brand-500/10 px-4 py-3 text-sm font-semibold text-brand-700">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['pending', 'verified', 'rejected'] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold capitalize transition-colors ${
              tab === key
                ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-[#0066ff]/40'
                : 'bg-admin-card border border-admin-border text-admin-text-secondary hover:bg-admin-card-hover'
            }`}
          >
            {key} <span className="ml-1 opacity-80">({counts[key]})</span>
          </button>
        ))}
      </div>

      {loading && counts.total === 0 ? (
        <SkeletonTable rows={6} columns={5} variant="dark" />
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
              : 'We could not load the KYC verification requests. Please try again.'
          }
          onRetry={() => void load()}
          variant="dark"
        />
      ) : lists[tab].length === 0 ? (
        <EmptyState
          title={`No ${tab} members`}
          description={
            tab === 'pending'
              ? 'When members register, their identity submissions appear here for review.'
              : `There are no members with a ${tab} verification status.`
          }
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
                  <th className="px-5 py-3 font-bold">Email</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold text-right">Registered</th>
                  <th className="px-5 py-3 font-bold text-right">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border-subtle">
                {lists[tab].map((customer) => {
                  const badge = kycBadge(customer.verification_status);
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
                          <p className="font-bold text-admin-text">
                            {customer.first_name} {customer.last_name}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-admin-text-secondary">{customer.phone}</td>
                      <td className="px-5 py-3.5 text-admin-text-secondary">{customer.email || '—'}</td>
                      <td className="px-5 py-3.5">
                        <StatusBadge tone={badge.tone} variant="dark">{badge.label}</StatusBadge>
                      </td>
                      <td className="px-5 py-3.5 text-admin-muted text-right whitespace-nowrap">
                        {formatDate(customer.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {tab === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => act(customer, 'verified', 'identity verified.')}
                              disabled={busyId !== null}
                              className="px-3 py-1.5 rounded-lg bg-success-600 text-[#0066ff] text-xs font-bold hover:bg-success-500 disabled:opacity-50 transition-colors"
                            >
                              {busyId === customer.id ? 'Working…' : '✓ Approve'}
                            </button>
                            <button
                              type="button"
                              onClick={() => act(customer, 'rejected', 'identity rejected.')}
                              disabled={busyId !== null}
                              className="px-3 py-1.5 rounded-lg border border-danger-500/40 text-danger-500 text-xs font-bold hover:bg-danger-500/10 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-admin-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
