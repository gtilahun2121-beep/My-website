interface KpiCardProps {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  accent?: 'brand' | 'accent' | 'warning' | 'success' | 'danger';
  variant?: 'light' | 'dark';
}

const ACCENTS = {
  brand: { light: 'bg-brand-100 text-brand-700', dark: 'bg-brand-100 text-brand-700' },
  accent: { light: 'bg-accent-100 text-accent-600', dark: 'bg-accent-100 text-accent-600' },
  warning: { light: 'bg-warning-100 text-warning-700', dark: 'bg-warning-100 text-warning-700' },
  success: { light: 'bg-success-100 text-success-700', dark: 'bg-success-100 text-success-700' },
  danger: { light: 'bg-danger-100 text-danger-700', dark: 'bg-danger-100 text-danger-700' },
} as const;

export default function KpiCard({
  label,
  value,
  hint,
  icon,
  accent = 'brand',
  variant = 'light',
}: KpiCardProps) {
  const iconBg = ACCENTS[accent][variant];

  return (
    <div
      className={`rounded-card border p-5 transition-colors ${
        variant === 'dark'
          ? 'bg-admin-card border-admin-border hover:bg-admin-card-hover'
          : 'bg-card border-slate-200 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className={`text-sm font-semibold ${
              variant === 'dark' ? 'text-admin-muted' : 'text-slate-500'
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-2 text-3xl font-black ${
              variant === 'dark' ? 'text-admin-text' : 'text-slate-900'
            }`}
          >
            {value}
          </p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p
        className={`mt-3 text-xs font-medium ${
          variant === 'dark' ? 'text-admin-disabled' : 'text-slate-400'
        }`}
      >
        {hint}
      </p>
    </div>
  );
}
