'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminAPI, APIError, AdminCustomerListResponse, ListUsersParams } from '@/app/services/api';
import AppShell from '@/app/components/admin/AppShell';
import KpiCard from '@/app/components/admin/KpiCard';
import { StatusBadge, roleBadge, activeBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { SkeletonTable, EmptyState, ErrorState } from '@/app/components/admin/States';

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

export default function RegisteredCustomersPage() {
  const [data, setData] = useState<AdminCustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AppShell title="Registered Customers" subtitle="Manage all members on the QalNet platform">
      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Members"
          value={loading && !summary ? '—' : (summary?.total ?? 0)}
          hint="All registered accounts"
          accent="brand"
          icon={kpiIcon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z')}
        />
        <KpiCard
          label="Active"
          value={loading && !summary ? '—' : (summary?.active ?? 0)}
          hint="Members with active accounts"
          accent="success"
          icon={kpiIcon('M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z')}
        />
        <KpiCard
          label="Hosts"
          value={loading && !summary ? '—' : (summary?.hosts ?? 0)}
          hint="Members running equbs"
          accent="accent"
          icon={kpiIcon('M4 21v-9m5 9v-7m5 7V4m5 17V10')}
        />
        <KpiCard
          label="New This Month"
          value={loading && !summary ? '—' : (summary?.new_this_month ?? 0)}
          hint="Registrations in the last 30 days"
          accent="warning"
          icon={kpiIcon('M3 17l6-6 4 4 7-7m0 0v5m0-5h-5')}
        />
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
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
            className="w-full py-2.5 pl-9 pr-3 rounded-lg bg-card border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="py-2.5 px-3 rounded-lg bg-card border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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
            className="py-2.5 px-3 rounded-lg bg-card border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
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

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {loading && !data ? (
        <SkeletonTable rows={8} columns={5} />
      ) : error ? (
        <ErrorState
          title={error === 'Request failed with status 401' || error === 'Request failed with status 403' ? 'Not authorized' : 'Something went wrong'}
          description={
            error === 'Request failed with status 401' || error === 'Request failed with status 403'
              ? 'You need an admin session to view this page. Sign in with an admin account and try again.'
              : 'We could not load the customer list. Please try again.'
          }
          onRetry={() => void load(filters(page))}
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={search || role || status ? 'No matching customers' : 'No customers yet'}
          description={
            search || role || status
              ? 'Try adjusting your search or clearing the filters.'
              : 'When members register on QalNet they will appear here.'
          }
        />
      ) : (
        <>
          <div className="bg-card rounded-card border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3 font-bold">Member</th>
                    <th className="px-5 py-3 font-bold">Phone</th>
                    <th className="px-5 py-3 font-bold">Email</th>
                    <th className="px-5 py-3 font-bold">Role</th>
                    <th className="px-5 py-3 font-bold">Status</th>
                    <th className="px-5 py-3 font-bold text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((customer) => {
                    const roleInfo = roleBadge(customer.role);
                    const statusInfo = activeBadge(customer.is_active);
                    return (
                      <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
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
                              <p className="font-bold text-slate-900">
                                {customer.first_name} {customer.last_name}
                              </p>
                              {customer.telegram_handle && (
                                <p className="text-xs text-slate-400">@{customer.telegram_handle}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{customer.phone}</td>
                        <td className="px-5 py-3.5 text-slate-600">{customer.email || '—'}</td>
                        <td className="px-5 py-3.5">
                          <StatusBadge tone={roleInfo.tone as BadgeTone}>{roleInfo.label}</StatusBadge>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge tone={statusInfo.tone}>{statusInfo.label}</StatusBadge>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-right whitespace-nowrap">
                          {formatDate(customer.created_at)}
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
            <p className="text-sm text-slate-500">
              Showing{' '}
              <span className="font-bold text-slate-700">
                {data.total === 0 ? 0 : (data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)}
              </span>{' '}
              of <span className="font-bold text-slate-700">{data.total}</span> members
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="px-3 py-2 rounded-lg bg-card border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm font-bold text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-3 py-2 rounded-lg bg-card border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
