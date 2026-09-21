interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  variant?: 'light' | 'dark';
}

export function SkeletonTable({ rows = 6, columns = 6, variant = 'light' }: SkeletonTableProps) {
  const cardCls =
    variant === 'dark'
      ? 'bg-admin-card border-admin-border'
      : 'bg-card border-gray-200';
  const barCls = variant === 'dark' ? 'bg-admin-elevated' : 'bg-gray-100';

  return (
    <div className={`rounded-card border overflow-hidden ${cardCls}`} aria-busy="true">
      <div className="divide-y divide-admin-border-subtle">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-6 px-5 py-4">
            {Array.from({ length: columns }).map((__, c) => (
              <div key={c} className={`h-4 shrink-0 rounded animate-pulse ${barCls} ${c === 0 ? 'w-32 sm:w-64' : c === columns - 1 ? 'w-20 ml-auto' : 'flex-1 shrink-1'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  variant?: 'light' | 'dark';
}

export function EmptyState({ title, description, variant = 'light' }: EmptyStateProps) {
  const dark = variant === 'dark';

  return (
    <div
      className={`rounded-card border py-16 px-6 text-center ${
        dark
          ? 'bg-admin-card border-dashed border-admin-border-strong'
          : 'bg-card border-dashed border-gray-300'
      }`}
    >
      <div
        className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ${
          dark ? 'bg-admin-elevated' : 'bg-gray-100'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-7 h-7 ${dark ? 'text-admin-muted' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2M8.5 11h5" />
        </svg>
      </div>
      <p className={`mt-4 text-base font-bold ${dark ? 'text-admin-text' : 'text-[#0066ff]'}`}>
        {title}
      </p>
      <p className={`mt-1 text-sm max-w-sm mx-auto ${dark ? 'text-admin-muted' : 'text-gray-500'}`}>
        {description}
      </p>
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
  variant?: 'light' | 'dark';
}

export function ErrorState({ title, description, onRetry, variant = 'light' }: ErrorStateProps) {
  const dark = variant === 'dark';

  return (
    <div
      className={`rounded-card border py-16 px-6 text-center ${
        dark
          ? 'bg-admin-card border-danger-500/25'
          : 'bg-card border-danger-100'
      }`}
    >
      <div
        className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ${
          dark ? 'bg-danger-500/15' : 'bg-danger-100'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-7 h-7 ${dark ? 'text-danger-500' : 'text-danger-600'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <p className={`mt-4 text-base font-bold ${dark ? 'text-admin-text' : 'text-[#0066ff]'}`}>
        {title}
      </p>
      <p className={`mt-1 text-sm max-w-sm mx-auto ${dark ? 'text-admin-muted' : 'text-gray-500'}`}>
        {description}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6" />
          </svg>
          Try again
        </button>
      )}
    </div>
  );
}
