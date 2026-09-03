'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { adminAPI } from '@/app/services/api';
import { useNotifications } from '@/app/hooks/useNotifications';
import { initials, roleLabel } from '../dashboard/format';

export type ShellVariant = 'member' | 'admin';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant?: ShellVariant;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  badge?: number;
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const icon = (path: string) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
    <path d={path} />
  </svg>
);

const MEMBER_NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: icon('M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5'),
  },
  {
    label: 'My Equbs',
    href: '/my-equbs',
    icon: icon('M17 21v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4M7 4h10a2 2 0 0 1 2 2v15H5V6a2 2 0 0 1 2-2Zm2 6h6m-6 4h6'),
  },
  {
    label: 'Wallet',
    href: '/wallet',
    icon: icon('M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z'),
  },
  {
    label: 'Request an Equb',
    href: '/create-equb',
    icon: icon('M12 5v14m-7-7h14'),
  },
];

const MEMBER_FOOTER: NavItem[] = [
  { label: 'Help Center', disabled: true, icon: icon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13a2.2 2.2 0 1 1 3.1 2c-1 .6-3.1 1.6-3.1 4m.01 3h.01') },
  {
    label: 'Settings',
    href: '/settings',
    icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a8.9 8.9 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8.9 8.9 0 0 0-2-1.2L15.5 3h-4l-.4 2.6a8.9 8.9 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a8.9 8.9 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a8.9 8.9 0 0 0 2 1.2l.4 2.6h4l.4-2.6a8.9 8.9 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z'),
  },
];

/**
 * QalNet Admin Console navigation — QalNet Admin Console DESIGN_SPEC.md §7.2.
 * Live routes reuse the existing QalNet routing; not-yet-built areas render as
 * disabled "coming soon" items (frontend visibility ≠ authorization).
 */
const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Primary',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard', icon: icon('M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5') },
      { label: 'Members & Access', href: '/admin/member-access', icon: icon('M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4') },
      { label: 'Members', href: '/admin/customers', icon: icon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z') },
      { label: 'Approvals', href: '/admin/approvals', icon: icon('M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z') },
      { label: 'KYC Verification', href: '/admin/kyc', icon: icon('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3.5-9.5L11 15l4.5-5.5') },
      { label: 'Finance', href: '/admin/finance', icon: icon('M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z') },
      { label: 'Payments', href: '/admin/payments', icon: icon('M2 8a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1Zm4 3h.01M6 12h.01M10 11h.01') },
      { label: 'Transactions', href: '/admin/transactions', icon: icon('M3 17l6-6 4 4 7-7m0 0v5m0-5h-5') },
      { label: 'Wallets', href: '/admin/wallets', icon: icon('M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 2v12m6-6h4') },
      { label: 'Equbs', href: '/admin/equbs', icon: icon('M4 21v-9m5 9v-7m5 7V4m5 17V10') },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { label: 'Reports', href: '/admin/reports', icon: icon('M5 20V10m7 10V4m7 16v-7') },
      { label: 'Analytics', href: '/admin/analytics', icon: icon('M12 3v3m6.4 2.6-2.1 2.1M21 12h-3M15.6 12H12') },
      { label: 'Notifications', icon: icon('M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9') },
      { label: 'System Logs', href: '/admin/system-logs', icon: icon('M4 5h16v14H4V5Zm4 4h8m-8 4h8') },
    ],
  },
];

export default function Sidebar({
  open,
  onClose,
  variant = 'admin',
  collapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isAdmin = variant === 'admin';
  const { unreadCount } = useNotifications(isAdmin);

  /* Move focus into the drawer when it opens (off-canvas) */
  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  /* Actionable badge: pending approval items (equb requests + join requests) */
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    Promise.all([adminAPI.listEqubRequests(), adminAPI.listPendingMemberships()])
      .then(([reqs, mems]) => {
        if (!cancelled) setPendingCount(reqs.length + mems.length);
      })
      .catch(() => {
        if (!cancelled) setPendingCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const handleSignOut = async () => {
    setProfileOpen(false);
    await signout();
    router.push('/');
  };

  /* ── Admin drawer ─────────────────────────────────────────────── */
  if (isAdmin) {
    const labelHidden = collapsed ? 'lg:hidden' : '';
    const isActiveRoute = (href: string) =>
      href === pathname || (href !== '/admin/dashboard' && pathname.startsWith(href));

    const renderAdminItem = (item: NavItem) => {
      const active = !!item.href && isActiveRoute(item.href);
      const badge =
        item.badge ??
        (item.label === 'Approvals' && pendingCount != null && pendingCount > 0 ? pendingCount : undefined) ??
        (item.label === 'Notifications' && unreadCount > 0 ? unreadCount : undefined);

      const linkCls = `relative flex items-center rounded-lg py-2.5 text-sm font-semibold transition-colors gap-3 ${
        collapsed ? 'lg:gap-0 lg:justify-center' : ''
      } px-3 ${collapsed ? 'lg:px-0' : ''} ${
        item.disabled
          ? 'text-admin-nav-muted/50 cursor-not-allowed'
          : active
            ? 'bg-brand-600 text-[#00d9ff]'
            : 'text-admin-nav-muted hover:text-admin-nav-text hover:bg-brand-50'
      }`;

      return (
        <li key={item.label}>
          {item.href && !item.disabled ? (
            <Link
              href={item.href}
              onClick={onClose}
              aria-current={active ? 'page' : undefined}
              className={linkCls}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-brand-400"
                />
              )}
              <span className={active ? 'text-brand-600' : ''}>{item.icon}</span>
              <span className={labelHidden}>{item.label}</span>
              {badge != null && (
                <span
                  className={`ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-500 text-[#00d9ff] text-[11px] font-black ${
                    collapsed ? 'lg:hidden' : ''
                  }`}
                  aria-label={`${badge} pending ${item.label.toLowerCase()} items`}
                >
                  {badge}
                </span>
              )}
              {badge != null && collapsed && (
                <span
                  aria-hidden="true"
                  className="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-400"
                />
              )}
            </Link>
          ) : (
            <span className={linkCls} aria-disabled="true" title="Coming soon">
              <span>{item.icon}</span>
              <span className={labelHidden}>{item.label}</span>
            </span>
          )}
        </li>
      );
    };

    return (
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-[width,transform] duration-200 lg:translate-x-0 lg:static
          bg-admin-nav text-admin-nav-text border-r border-admin-nav-border
          ${collapsed ? 'w-60 lg:w-[72px]' : 'w-60'}
          ${open ? 'translate-x-0' : '-translate-x-full'}
          shadow-2xl shadow-slate-950/30`}
        aria-label="Admin navigation"
      >
        {/* Brand */}
        <Link
          href="/admin/dashboard"
          onClick={onClose}
          className={`flex items-center gap-3 h-16 shrink-0 border-b border-admin-nav-border px-5 ${
            collapsed ? 'lg:px-0 lg:justify-center' : ''
          }`}
          aria-label="QalNet Admin Console — Dashboard"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-[#00d9ff] font-black text-lg shadow-lg shadow-brand-950/40 shrink-0">
            Q
          </div>
          <div className={labelHidden}>
            <p className="font-black leading-none text-admin-nav-text">QalNet</p>
            <p className="text-xs mt-0.5 text-admin-nav-muted">Admin Console</p>
          </div>
        </Link>

        {/* Close button (off-canvas only) */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="lg:hidden absolute top-4 right-3 p-1.5 rounded-lg text-admin-nav-muted hover:text-admin-nav-text hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          aria-label="Close admin navigation"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        {/* Primary navigation */}
        <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3 py-4">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.heading ?? 'default'} className={group.heading ? 'pt-4 first:pt-0' : ''}>
              {group.heading && (
                <p
                  className={`px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-admin-nav-muted/60 ${
                    collapsed ? 'lg:hidden' : ''
                  }`}
                >
                  {group.heading}
                </p>
              )}
              <ul className="space-y-1">{group.items.map(renderAdminItem)}</ul>
            </div>
          ))}
        </nav>

        {/* System status */}
        <div className="px-3 shrink-0">
          <div className="rounded-xl border border-admin-nav-border bg-admin-nav-elevated p-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success-500" aria-hidden="true" />
              <p className="text-xs font-bold text-admin-nav-text">System Status</p>
            </div>
            <p className="text-[11px] text-admin-nav-muted mt-1.5">All systems operational</p>
            <span className="text-[11px] font-bold text-brand-400 mt-1.5 inline-block" title="Coming soon">
              View status page →
            </span>
          </div>
        </div>

        {/* Collapse toggle (desktop) */}
        {onToggleCollapsed && (
          <div className="px-3 py-2 shrink-0 border-t border-admin-nav-border">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className={`flex items-center w-full rounded-lg py-2 text-xs font-bold text-admin-nav-muted hover:text-admin-nav-text hover:bg-brand-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 gap-3 ${
                collapsed ? 'lg:gap-0 lg:justify-center' : ''
              } px-3 ${collapsed ? 'lg:px-0' : ''}`}
            >
              <svg
                viewBox="0 0 24 24"
                className={`w-4.5 h-4.5 transition-transform ${collapsed ? 'lg:rotate-180' : ''}`}
                {...stroke}
              >
                <path d="m15 6-6 6 6 6" />
              </svg>
              <span className={`${labelHidden} lg:block`}>Collapse</span>
            </button>
          </div>
        )}

        {/* Administrator profile */}
        {user && (
          <div className="shrink-0 border-t border-admin-nav-border p-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className={`flex w-full items-center rounded-lg p-2 text-left transition-colors hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 gap-3 ${
                  collapsed ? 'lg:gap-0 lg:justify-center' : ''
                }`}
              >
                {user.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.profilePhoto}
                    alt={''}
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand-600 text-[#00d9ff] flex items-center justify-center text-sm font-bold shrink-0">
                    {initials(user.firstName, user.lastName)}
                  </div>
                )}
                <span className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
                  <span className="block text-sm font-bold text-admin-nav-text truncate">
                    {`${user.firstName} ${user.lastName}`.trim() || 'Administrator'}
                  </span>
                  <span className="block text-xs text-admin-nav-muted capitalize truncate">
                    {roleLabel(user.role)}
                  </span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className={`w-4 h-4 text-admin-nav-muted transition-transform shrink-0 ${
                    profileOpen ? 'rotate-180' : ''
                  } ${collapsed ? 'lg:hidden' : ''}`}
                  {...stroke}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full left-3 right-3 mb-2 rounded-xl bg-admin-nav-elevated border border-admin-nav-border shadow-xl shadow-slate-950/40 overflow-hidden z-50"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-semibold text-danger-500 hover:bg-brand-50"
                  >
                    <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" {...stroke}>
                      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3m4 13 5-5m0 0-5-5m5 5H9" />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    );
  }

  /* ── Member drawer ────────────────────────────────────────────── */
  const memberItemCls = (item: NavItem) => {
    const active = !!item.href && item.href === pathname;
    const base =
      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors';
    if (item.disabled) return `${base} text-gray-300 cursor-not-allowed`;
    if (active) return `${base} bg-brand-100 text-brand-800`;
    return `${base} text-gray-600 hover:bg-gray-100 hover:text-[#00d9ff]`;
  };

  const renderMemberItem = (item: NavItem) =>
    item.href ? (
      <Link
        key={item.label}
        href={item.href}
        onClick={onClose}
        className={memberItemCls(item)}
        aria-current={item.href === pathname ? 'page' : undefined}
      >
        <span className={item.href === pathname ? 'text-brand-600' : 'text-gray-400'}>{item.icon}</span>
        {item.label}
      </Link>
    ) : (
      <span key={item.label} className={memberItemCls(item)} aria-disabled="true" title="Coming soon">
        <span className="text-gray-300">{item.icon}</span>
        {item.label}
      </span>
    );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-60 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static bg-card border-r border-gray-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      aria-label="Sidebar navigation"
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        className="flex items-center gap-3 px-5 h-16 border-b border-gray-100"
        onClick={onClose}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-[#00d9ff] font-black text-lg shadow-lg shadow-brand-900/50">
          Q
        </div>
        <div>
          <p className="font-black leading-none text-[#00d9ff]">QalNet</p>
          <p className="text-xs mt-0.5 text-gray-400">{'Ethiopia\'s Digital Equb'}</p>
        </div>
      </Link>

      {/* Close button (off-canvas only) */}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="lg:hidden absolute top-4 right-3 p-1.5 rounded-lg text-gray-400 hover:text-[#00d9ff] hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label="Close navigation"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" {...stroke}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">{MEMBER_NAV.map(renderMemberItem)}</div>
      </nav>

      {/* Help card */}
      <div className="px-3 pb-3">
        <div className="rounded-card p-4 bg-gray-50 border border-gray-100">
          <p className="text-sm font-bold text-[#00d9ff]">Need help?</p>
          <p className="text-xs mt-1 text-gray-500">
            Our support team is ready to help you.
          </p>
          <button
            type="button"
            className="mt-3 w-full py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-[#00d9ff] text-xs font-bold hover:from-brand-500 hover:to-brand-400 transition-all"
          >
            Contact Support
          </button>
        </div>
      </div>

      {/* Footer nav */}
      <div className="px-3 pb-4 space-y-1 pt-3 border-t border-gray-100">
        {MEMBER_FOOTER.map(renderMemberItem)}
      </div>
    </aside>
  );
}
