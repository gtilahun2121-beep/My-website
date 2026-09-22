interface KpiCardProps {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  accent?: 'brand' | 'accent' | 'warning' | 'success' | 'danger';
  variant?: 'light' | 'dark';
}

const ACCENTS = {
  brand: { light: 'bg-brand-100 text-[#0042ad]', dark: 'bg-brand-500/15 text-brand-300' },
  accent: { light: 'bg-accent-100 text-accent-700', dark: 'bg-accent-500/15 text-accent-300' },
  warning: { light: 'bg-warning-100 text-warning-700', dark: 'bg-warning-500/15 text-warning-300' },
  success: { light: 'bg-success-100 text-success-700', dark: 'bg-success-500/15 text-success-300' },
  danger: { light: 'bg-danger-100 text-danger-700', dark: 'bg-danger-500/15 text-danger-300' },
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
      className={`rounded-card border p-2.5 transition-colors ${
        variant === 'dark'
          ? 'bg-admin-card border-admin-border hover:bg-admin-card-hover'
          : 'bg-card border-gray-200 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-semibold truncate ${
              variant === 'dark' ? 'text-admin-muted' : 'text-gray-500'
            }`}
          >
            {label}
          </p>
          <p
            className={`mt-0.5 text-lg font-black truncate ${
              variant === 'dark' ? 'text-admin-text' : 'text-[#0066ff]'
            }`}
          >
            {value}
          </p>
        </div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p
        className={`mt-1 text-[10px] font-medium truncate ${
          variant === 'dark' ? 'text-admin-disabled' : 'text-gray-400'
        }`}
      >
        {hint}
      </p>
    </div>
  );
}
