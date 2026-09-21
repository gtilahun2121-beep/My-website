import type { AdminCustomer } from '../../services/api';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export const TONE_STYLES: Record<BadgeTone, string> = {
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-brand-100 text-[#0042ad]',
  accent: 'bg-accent-100 text-accent-700',
  neutral: 'bg-gray-100 text-gray-600',
};

export const TONE_STYLES_DARK: Record<BadgeTone, string> = {
  success: 'bg-success-500/15 text-success-300 border border-success-500/30',
  warning: 'bg-warning-500/15 text-warning-300 border border-warning-500/30',
  danger: 'bg-danger-500/15 text-danger-300 border border-danger-500/30',
  info: 'bg-brand-500/15 text-brand-300 border border-brand-500/30',
  accent: 'bg-accent-500/15 text-accent-300 border border-accent-500/30',
  neutral: 'bg-admin-disabled/20 text-admin-muted border border-admin-border-subtle',
};

interface StatusBadgeProps {
  tone: BadgeTone;
  variant?: 'light' | 'dark';
  children: React.ReactNode;
}

export function StatusBadge({ tone, variant = 'light', children }: StatusBadgeProps) {
  const toneCls = variant === 'dark' ? TONE_STYLES_DARK[tone] : TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${toneCls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}

export function roleBadge(role: AdminCustomer['role']) {
  switch (role) {
    case 'admin':
      return { tone: 'accent' as const, label: 'Admin' };
    case 'host':
      return { tone: 'info' as BadgeTone, label: 'Host' };
    default:
      return { tone: 'neutral' as BadgeTone, label: 'Member' };
  }
}

export function activeBadge(isActive: boolean) {
  return isActive
    ? { tone: 'success' as BadgeTone, label: 'Active' }
    : { tone: 'neutral' as BadgeTone, label: 'Inactive' };
}
