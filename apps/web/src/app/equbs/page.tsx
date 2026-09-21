'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/admin/AppShell';
import { StatusBadge, type BadgeTone } from '@/app/components/admin/StatusBadge';
import { useAuth } from '@/app/context/AuthContext';
import { equbAPI, APIError } from '@/app/services/api';
import type { EqubGroup } from '@qalnet/shared-types';

interface EqubFilters {
  search: string;
  status: 'all' | 'active' | 'completed' | 'open' | 'cancelled';
  cycle: 'all' | 'daily' | 'weekly' | 'monthly';
  sortBy: 'newest' | 'name' | 'members' | 'amount';
}

export default function EqubsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [equbs, setEqubs] = useState<EqubGroup[]>([]);
  const [filteredEqubs, setFilteredEqubs] = useState<EqubGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<EqubFilters>({
    search: '',
    status: 'active',
    cycle: 'all',
    sortBy: 'newest',
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch equbs
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;

    const fetchEqubs = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await equbAPI.getAll();
        setEqubs(data || []);
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.data?.message || err.message
            : err instanceof Error
              ? err.message
              : 'Failed to load equbs';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchEqubs();
  }, [isAuthenticated, isLoading]);

  // Apply filters and sorting
  useEffect(() => {
    let result = [...equbs];

    // Search filter
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        e =>
          e.name.toLowerCase().includes(q) ||
          (e.description?.toLowerCase().includes(q) ?? false)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      result = result.filter(e => e.status === filters.status);
    }

    // Cycle days filter (convert to daily/weekly/monthly)
    if (filters.cycle !== 'all') {
      const cycleDays = {
        daily: 1,
        weekly: 7,
        monthly: 30,
      } as Record<string, number>;
      const targetDays = cycleDays[filters.cycle];
      result = result.filter(e => e.cycle_days === targetDays);
    }

    // Sorting
    switch (filters.sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'members':
        result.sort((a, b) => b.member_count - a.member_count);
        break;
      case 'amount':
        result.sort((a, b) => b.contribution_amount - a.contribution_amount);
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    setFilteredEqubs(result);
  }, [equbs, filters]);

  const getStatusTone = (status: string): BadgeTone => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'open': return 'accent';
      case 'cancelled': return 'danger';
      default: return 'neutral';
    }
  };

  const getCycleLabel = (days: number): string => {
    if (days === 1) return 'Daily';
    if (days === 7) return 'Weekly';
    if (days === 30) return 'Monthly';
    return `${days} Days`;
  };

  if (isLoading || loading) {
    return (
      <AppShell title="All Equbs" subtitle="Browse and join rotating savings groups" variant="member">
        <div className="flex items-center justify-center py-12">
          <div className="w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AppShell title="All Equbs" subtitle="Browse and join rotating savings groups" variant="member">
      <div className="space-y-6">
        {/* Filters & Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 mb-2 block">Search by name or description</span>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                  placeholder="Search equbs..."
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
                />
              </label>
            </div>

            {/* Status Filter */}
            <label className="block">
              <span className="text-xs font-semibold text-gray-600 mb-2 block">Status</span>
              <select
                value={filters.status}
                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            {/* Cycle Filter */}
            <label className="block">
              <span className="text-xs font-semibold text-gray-600 mb-2 block">Cycle</span>
              <select
                value={filters.cycle}
                onChange={(e) => setFilters(f => ({ ...f, cycle: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="all">All Cycles</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            {/* Sort By */}
            <label className="block">
              <span className="text-xs font-semibold text-gray-600 mb-2 block">Sort By</span>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as any }))}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              >
                <option value="newest">Newest First</option>
                <option value="name">Name (A-Z)</option>
                <option value="members">Most Members</option>
                <option value="amount">Highest Amount</option>
              </select>
            </label>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}

        {/* Results Summary */}
        <div className="text-sm text-gray-600">
          Showing <strong>{filteredEqubs.length}</strong> of <strong>{equbs.length}</strong> equbs
        </div>

        {/* Equbs Grid */}
        {filteredEqubs.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-lg font-bold text-gray-900">No equbs found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your filters or create a new equb
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEqubs.map((equb) => (
              <div
                key={equb.id}
                onClick={() => router.push(`/equbs/${equb.id}`)}
                className="bg-white rounded-lg border border-gray-200 hover:border-brand-400 transition-all cursor-pointer hover:shadow-lg overflow-hidden"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-4 py-3 text-white">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-sm leading-snug line-clamp-2">{equb.name}</h3>
                    </div>
                    <StatusBadge tone={getStatusTone(equb.status)}>
                      {equb.status.charAt(0).toUpperCase() + equb.status.slice(1)}
                    </StatusBadge>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="text-xs text-gray-600 line-clamp-2 mb-3">{equb.description || 'No description'}</p>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Contribution</p>
                      <p className="text-sm font-bold text-brand-600">ETB {equb.contribution_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Total Amount</p>
                      <p className="text-sm font-bold text-brand-600">ETB {equb.total_amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Cycle</p>
                      <p className="text-sm font-bold text-brand-600">{getCycleLabel(equb.cycle_days)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500">Members</p>
                      <p className="text-sm font-bold text-brand-600">{equb.member_count} joined</p>
                    </div>
                  </div>

                  {/* Round Info */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4 pb-4 border-t border-gray-100">
                    <span>Round {equb.current_round}/{equb.total_rounds}</span>
                    <span>{Math.round((equb.member_count / equb.total_rounds) * 100)}% filled</span>
                  </div>

                  {/* View Button */}
                  <button
                    className="w-full px-3 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/equbs/${equb.id}`);
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
