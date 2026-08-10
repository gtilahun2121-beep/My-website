interface KpiCardProps {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  accent?: 'brand' | 'accent' | 'warning' | 'success' | 'danger';
}

const ACCENTS = {
  brand: { iconBg: 'bg-brand-100 text-brand-700' },
  accent: { iconBg: 'bg-accent-100 text-accent-600' },
  warning: { iconBg: 'bg-warning-100 text-warning-700' },
  success: { iconBg: 'bg-success-100 text-success-700' },
  danger: { iconBg: 'bg-danger-100 text-danger-700' },
} as const;

export default function KpiCard({ label, value, hint, icon, accent = 'brand' }: KpiCardProps) {
  const { iconBg } = ACCENTS[accent];

  return (
    <div className="bg-card rounded-card border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-400">{hint}</p>
    </div>
  );
}
