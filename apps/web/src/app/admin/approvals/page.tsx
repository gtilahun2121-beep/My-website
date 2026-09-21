'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminAPI, APIError, type PendingMembership } from '@/app/services/api';
import { StatusBadge } from '@/app/components/admin/StatusBadge';
import { EmptyState, ErrorState } from '@/app/components/admin/States';
import type { EqubCreationRequest } from '@qalnet/shared-types';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

type Tab = 'equbs' | 'memberships';

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

function money(n: number | string) {
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export default function AdminApprovalsPage() {
  const [tab, setTab] = useState<Tab>('equbs');
  const [equbRequests, setEqubRequests] = useState<EqubCreationRequest[]>([]);
  const [memberships, setMemberships] = useState<PendingMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqs, mems] = await Promise.all([
        adminAPI.listEqubRequests(),
        adminAPI.listPendingMemberships(),
      ]);
      setEqubRequests(reqs);
      setMemberships(mems);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.data?.message || err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load approvals.';
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
    setMessage(null);
    try {
      await action();
      setMessage(successText);
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

  const pendingEqubCount = equbRequests.length;
  const pendingMembershipCount = memberships.length;

  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  return (
    <>
      {/* Message banner */}
      {message && (
        <div className="bg-brand-100 border border-brand-200 text-brand-700 rounded-lg px-4 py-3 text-sm font-semibold">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('equbs')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === 'equbs'
              ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-[#0066ff]/40'
              : 'bg-admin-card border border-admin-border text-admin-text-secondary hover:bg-admin-card-hover'
          }`}
        >
          Equb Requests {pendingEqubCount > 0 && <span className="ml-1 opacity-80">({pendingEqubCount})</span>}
        </button>
        <button
          type="button"
          onClick={() => setTab('memberships')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === 'memberships'
              ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-[#0066ff]/40'
              : 'bg-admin-card border border-admin-border text-admin-text-secondary hover:bg-admin-card-hover'
          }`}
        >
          Join Requests {pendingMembershipCount > 0 && <span className="ml-1 opacity-80">({pendingMembershipCount})</span>}
        </button>
      </div>

      {loading ? (
        <div className="bg-admin-card rounded-card border border-admin-border p-8 text-center text-admin-muted text-sm font-semibold">
          Loading…
        </div>
      ) : error ? (
        <ErrorState
          title={error === 'Request failed with status 401' || error === 'Request failed with status 403' ? 'Not authorized' : 'Something went wrong'}
          description={
            error === 'Request failed with status 401' || error === 'Request failed with status 403'
              ? 'You need an admin session to view this page. Sign in with an admin account and try again.'
              : 'We could not load the approvals. Please try again.'
          }
          onRetry={() => void load()}
          variant="dark"
        />
      ) : tab === 'equbs' ? (
        <EqubRequestsSection
          requests={equbRequests}
          busyId={busyId}
          onApprove={(id) =>
            act(id, () => adminAPI.approveEqubRequest(id), 'Equb created and member approved.')
          }
          onReject={(id) =>
            act(id, () => adminAPI.rejectEqubRequest(id), 'Creation request rejected.')
          }
        />
      ) : (
        <MembershipsSection
          memberships={memberships}
          busyId={busyId}
          onApprove={(id) =>
            act(id, () => adminAPI.approveMembership(id), 'Join request approved.')
          }
          onReject={(id) =>
            act(id, () => adminAPI.rejectMembership(id), 'Join request rejected.')
          }
        />
      )}
    </>
  );
}

// ── Equb creation requests ────────────────────────────────────────────────

function EqubRequestsSection({
  requests,
  busyId,
  onApprove,
  onReject,
}: {
  requests: EqubCreationRequest[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (requests.length === 0) {
    return (
      <EmptyState
        title="No Equb creation requests"
        description="When members ask the admin to create an Equb, their requests will appear here."
        variant="dark"
      />
    );
  }

  return (
    <div className="bg-admin-card rounded-card border border-admin-border overflow-hidden">
      <div className="divide-y divide-admin-border-subtle">
        {requests.map((req) => (
          <div key={req.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-admin-text">{req.name}</p>
                <StatusBadge tone="warning" variant="dark">pending</StatusBadge>
              </div>
              <p className="mt-1 text-xs text-admin-muted">
                Requested by{' '}
                <span className="font-bold text-admin-text-secondary">
                  {req.requester_first_name} {req.requester_last_name}
                </span>{' '}
                · {req.requester_phone} · {formatDate(req.created_at)}
              </p>
              {req.description && (
                <p className="mt-1.5 text-sm text-admin-text-secondary line-clamp-2">{req.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-admin-muted">
                <span>
                  Contribution: <strong className="text-admin-text">ETB {money(req.contribution_amount)}</strong>
                </span>
                <span>
                  Rounds: <strong className="text-admin-text">{req.total_rounds}</strong>
                </span>
                <span>
                  Cycle: <strong className="text-admin-text">{req.cycle_days} days</strong>
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onApprove(req.id)}
                disabled={busyId !== null}
                className="px-4 py-2 rounded-lg bg-success-600 text-[#0066ff] text-sm font-bold hover:bg-success-500 disabled:opacity-50 transition-colors"
              >
                {busyId === req.id ? 'Working…' : '✅ Approve & Create'}
              </button>
              <button
                type="button"
                onClick={() => onReject(req.id)}
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
  );
}

// ── Join requests ─────────────────────────────────────────────────────────

function MembershipsSection({
  memberships,
  busyId,
  onApprove,
  onReject,
}: {
  memberships: PendingMembership[];
  busyId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (memberships.length === 0) {
    return (
      <EmptyState
        title="No pending join requests"
        description="When members request to join an Equb, their requests will appear here."
        variant="dark"
      />
    );
  }

  return (
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
                onClick={() => onApprove(m.id)}
                disabled={busyId !== null}
                className="px-4 py-2 rounded-lg bg-success-600 text-[#0066ff] text-sm font-bold hover:bg-success-500 disabled:opacity-50 transition-colors"
              >
                {busyId === m.id ? 'Working…' : '✅ Approve'}
              </button>
              <button
                type="button"
                onClick={() => onReject(m.id)}
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
  );
}
