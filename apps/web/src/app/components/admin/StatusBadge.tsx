import type { AdminCustomer } from '../../services/api';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const TONE_STYLES: Record<BadgeTone, string> = {
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-brand-100 text-brand-700',
  neutral: 'bg-slate-100 text-slate-600',
};

export const TONE_STYLES_DARK: Record<BadgeTone, string> = {
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-brand-100 text-brand-700',
  neutral: 'bg-slate-100 text-slate-600',
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
      return { tone: 'accent' as BadgeTone, label: 'Admin' };
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
