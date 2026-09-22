'use client';

import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';

interface Action {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  iconBg: string;
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

const ACTIONS: Action[] = [
  {
    label: 'Create an Equb',
    description: 'Start a savings circle with your group',
    href: '/create-equb',
    icon: icon('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M12 11v5m-2.5-2.5h5'),
    iconBg: 'bg-accent-100 text-accent-600',
  },
  {
    label: 'Make Payment',
    description: 'Contribute to your Equb from your wallet',
    href: '/wallet',
    icon: icon('M3 10h18M7 15h2m4 0h2M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z'),
    iconBg: 'bg-success-100 text-success-700',
  },
  {
    label: 'Invite Members',
    description: 'Grow your Equb with trusted members',
    href: '/my-equbs',
    icon: icon('M16 11a3 3 0 1 0-6 0m6 0a3 3 0 1 1-6 0m6 0h.01M10 11h-.01M12 14c-3.87 0-7 1.57-7 3.5V21h14v-3.5C19 15.57 15.87 14 12 14Z'),
    iconBg: 'bg-warning-100 text-warning-700',
  },
];

export default function QuickActions() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const actions: Action[] = isAdmin
    ? [
        ...ACTIONS.filter((a) => a.label !== 'Create an Equb'),
        {
          label: 'Create an Equb',
          description: 'Launch a savings circle for members',
          href: '/create-equb',
          icon: icon('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M12 11v5m-2.5-2.5h5'),
          iconBg: 'bg-accent-100 text-accent-600',
        },
      ]
    : ACTIONS.map((a) =>
        a.label === 'Create an Equb'
          ? {
              ...a,
              label: 'Request an Equb',
              description: 'Ask the admin to create a savings circle',
            }
          : a,
      );

  return (
    <section className="bg-card rounded-card border border-gray-200">
      <div className="px-4 pt-2 pb-1.5">
        <h2 className="text-sm font-black text-[#0066ff]">Quick Actions</h2>
      </div>

      <div className="px-4 pb-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-2.5 rounded-xl border border-gray-200 px-3 py-2 hover:border-brand-300 hover:shadow-sm transition-all"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${action.iconBg}`}>
              {action.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#0066ff] leading-tight">{action.label}</p>
              <p className="mt-0.5 text-[11px] text-gray-500 truncate leading-tight">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
