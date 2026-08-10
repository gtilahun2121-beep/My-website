'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type ShellVariant = 'member' | 'admin';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  variant?: ShellVariant;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  disabled?: boolean;
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
    label: 'Discover Equbs',
    href: '/discover',
    icon: icon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3-12-5 3.4v-2.4H8m4 4.4 3-3.4'),
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

const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/admin/dashboard',
        icon: icon('M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5'),
      },
      {
        label: 'Members',
        href: '/admin/customers',
        icon: icon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z'),
      },
      {
        label: 'Approvals',
        href: '/admin/approvals',
        icon: icon('M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z'),
      },
    ],
  },
  {
    heading: 'Finance',
    items: [
      {
        label: 'Payments',
        disabled: true,
        icon: icon('M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z'),
      },
      {
        label: 'Transactions',
        disabled: true,
        icon: icon('M3 17l6-6 4 4 7-7m0 0v5m0-5h-5'),
      },
    ],
  },
  {
    heading: 'Operations',
    items: [
      {
        label: 'KYC',
        disabled: true,
        icon: icon('M9 12l2 2 4-4m5.6 2A7.5 7.5 0 1 1 6.4 6.4 7.5 7.5 0 0 1 20.6 10Z'),
      },
      {
        label: 'Reports',
        disabled: true,
        icon: icon('M5 20V10m7 10V4m7 16v-7'),
      },
      {
        label: 'Notifications',
        disabled: true,
        icon: icon('M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9'),
      },
    ],
  },
];

const FOOTER_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Help Center', disabled: true, icon: icon('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13a2.2 2.2 0 1 1 3.1 2c-1 .6-3.1 1.6-3.1 4m.01 3h.01') },
      {
        label: 'Settings',
        href: '/settings',
        icon: icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8.4-3a8.9 8.9 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8.9 8.9 0 0 0-2-1.2L15.5 3h-4l-.4 2.6a8.9 8.9 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a8.9 8.9 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a8.9 8.9 0 0 0 2 1.2l.4 2.6h4l.4-2.6a8.9 8.9 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2Z')
      },
    ],
  },
];
export default function Sidebar({ open, onClose, variant = 'admin' }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = variant === 'admin';

  const renderItem = (item: NavItem) => {
    const isActive = item.href === pathname;

    const className = isAdmin
      ? `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          item.disabled
            ? 'text-admin-disabled cursor-not-allowed'
            : isActive
              ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-900/40'
              : 'text-admin-text-secondary hover:bg-admin-card hover:text-admin-text'
        }`
      : `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          item.disabled
            ? 'text-slate-300 cursor-not-allowed'
            : isActive
              ? 'bg-brand-100 text-brand-800'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`;

    const iconColor = isAdmin
      ? isActive
        ? 'text-white'
        : 'text-admin-muted'
      : isActive
        ? 'text-brand-600'
        : 'text-slate-400';

    return item.href ? (
      <Link key={item.label} href={item.href} className={className} onClick={onClose}>
        <span className={iconColor}>{item.icon}</span>
        {item.label}
      </Link>
    ) : (
      <span key={item.label} className={className} aria-disabled="true" title="Coming soon">
        <span className={isAdmin ? 'text-admin-disabled' : 'text-slate-300'}>{item.icon}</span>
        {item.label}
      </span>
    );
  };

  const renderGroup = (group: NavGroup) => (
    <div key={group.heading ?? 'default'} className={group.heading ? 'pt-4 first:pt-0' : ''}>
      {group.heading && (
        <p
          className={`px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider ${
            isAdmin ? 'text-admin-disabled' : 'text-slate-400'
          }`}
        >
          {group.heading}
        </p>
      )}
      <div className="space-y-1">{group.items.map(renderItem)}</div>
    </div>
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-60 lg:w-60 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static ${
        isAdmin
          ? 'bg-admin-sidebar border-r border-admin-border'
          : 'bg-card border-r border-slate-200'
      } ${open ? 'translate-x-0' : '-translate-x-full'}`}
      aria-label="Sidebar navigation"
    >
      {/* Brand */}
      <Link
        href={variant === 'member' ? '/dashboard' : '/admin/dashboard'}
        className={`flex items-center gap-3 px-5 h-16 border-b ${
          isAdmin ? 'border-admin-border' : 'border-slate-100'
        }`}
        onClick={onClose}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-black shadow-lg shadow-brand-900/50">
          Q
        </div>
        <div>
          <p className={`font-black leading-none ${isAdmin ? 'text-admin-text' : 'text-slate-900'}`}>
            QalNet
          </p>
          <p className={`text-xs mt-0.5 ${isAdmin ? 'text-admin-muted' : 'text-slate-400'}`}>
            {isAdmin ? 'Admin Console' : "Ethiopia's Digital Equb"}
          </p>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {isAdmin
          ? ADMIN_NAV_GROUPS.map(renderGroup)
          : <div className="space-y-1">{MEMBER_NAV.map(renderItem)}</div>}
      </nav>

      {/* Help card */}
      <div className="px-3 pb-3">
        <div
          className={`rounded-card p-4 ${
            isAdmin
              ? 'bg-gradient-to-br from-admin-elevated to-admin-card border border-admin-border'
              : 'bg-slate-50 border border-slate-100'
          }`}
        >
          <p className={`text-sm font-bold ${isAdmin ? 'text-admin-text' : 'text-slate-700'}`}>
            Need help?
          </p>
          <p className={`text-xs mt-1 ${isAdmin ? 'text-admin-muted' : 'text-slate-500'}`}>
            Our support team is ready to help you.
          </p>
          <button
            type="button"
            className="mt-3 w-full py-2 rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs font-bold hover:from-brand-500 hover:to-brand-400 transition-all"
          >
            Contact Support
          </button>
        </div>
      </div>

      {/* Footer nav */}
      <div
        className={`px-3 pb-4 space-y-1 pt-3 border-t ${
          isAdmin ? 'border-admin-border' : 'border-slate-100'
        }`}
      >
        {isAdmin ? FOOTER_GROUPS[0].items.map(renderItem) : FOOTER_GROUPS[0].items.map(renderItem)}
      </div>
    </aside>
  );
}
