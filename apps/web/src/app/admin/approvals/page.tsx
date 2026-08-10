'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminAPI, APIError } from '@/app/services/api';
import AppShell from '@/app/components/admin/AppShell';
import { StatusBadge, BadgeTone } from '@/app/components/admin/StatusBadge';
import { EmptyState, ErrorState } from '@/app/components/admin/States';
import type { EqubCreationRequest } from '@qalnet/shared-types';

interface PendingMembership {
  id: string;
  user_id: string;
  equb_id: string;
  status: string;
  joined_at: string;
  user_first_name: string;
  user_last_name: string;
  user_phone: string;
  user_email: string;
  equb_name: string;
  equb_contribution: number;
  equb_total_rounds: number;
}

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
    void load();
  }, [load]);

  const act = async (id: string, action: () => Promise<any>, successText: string) => {
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

  return (
    <AppShell title="Approvals" subtitle="Review Equb creation and membership join requests">
      {/* Message banner */}
      {message && (
        <div className="bg-brand-50 border border-brand-200 text-brand-800 rounded-lg px-4 py-3 text-sm font-semibold">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('equbs')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === 'equbs'
              ? 'bg-brand-600 text-white'
              : 'bg-card border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Equb Requests {pendingEqubCount > 0 && <span className="ml-1 opacity-80">({pendingEqubCount})</span>}
        </button>
        <button
          type="button"
          onClick={() => setTab('memberships')}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === 'memberships'
              ? 'bg-brand-600 text-white'
              : 'bg-card border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Join Requests {pendingMembershipCount > 0 && <span className="ml-1 opacity-80">({pendingMembershipCount})</span>}
        </button>
      </div>

      {loading ? (
        <div className="bg-card rounded-card border border-slate-200 p-8 text-center text-slate-400 text-sm font-semibold">
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
    </AppShell>
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
      />
    );
  }

  return (
    <div className="bg-card rounded-card border border-slate-200 overflow-hidden">
      <div className="divide-y divide-slate-100">
        {requests.map((req) => (
          <div key={req.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-slate-900">{req.name}</p>
                <StatusBadge tone="warning">pending</StatusBadge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Requested by{' '}
                <span className="font-bold text-slate-700">
                  {req.requester_first_name} {req.requester_last_name}
                </span>{' '}
                · {req.requester_phone} · {formatDate(req.created_at)}
              </p>
              {req.description && (
                <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{req.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>
                  Contribution: <strong className="text-slate-700">ETB {money(req.contribution_amount)}</strong>
                </span>
                <span>
                  Rounds: <strong className="text-slate-700">{req.total_rounds}</strong>
                </span>
                <span>
                  Cycle: <strong className="text-slate-700">{req.cycle_days} days</strong>
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onApprove(req.id)}
                disabled={busyId !== null}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {busyId === req.id ? 'Working…' : '✅ Approve & Create'}
              </button>
              <button
                type="button"
                onClick={() => onReject(req.id)}
                disabled={busyId !== null}
                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 disabled:opacity-50 transition-colors"
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
      />
    );
  }

  return (
    <div className="bg-card rounded-card border border-slate-200 overflow-hidden">
      <div className="divide-y divide-slate-100">
        {memberships.map((m) => (
          <div key={m.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-slate-900">
                  {m.user_first_name} {m.user_last_name}
                </p>
                <StatusBadge tone="warning">pending</StatusBadge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {m.user_phone} · {m.user_email || 'no email'}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>
                  Equb: <strong className="text-slate-700">{m.equb_name}</strong>
                </span>
                <span>
                  Contribution: <strong className="text-slate-700">ETB {money(m.equb_contribution)}</strong>
                </span>
                <span>Requested {formatDate(m.joined_at)}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onApprove(m.id)}
                disabled={busyId !== null}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {busyId === m.id ? 'Working…' : '✅ Approve'}
              </button>
              <button
                type="button"
                onClick={() => onReject(m.id)}
                disabled={busyId !== null}
                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50 disabled:opacity-50 transition-colors"
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
