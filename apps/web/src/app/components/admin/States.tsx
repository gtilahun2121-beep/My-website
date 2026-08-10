interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 6, columns = 6 }: SkeletonTableProps) {
  return (
    <div className="bg-card rounded-card border border-slate-200 overflow-hidden" aria-busy="true">
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-6 px-5 py-4">
            {Array.from({ length: columns }).map((__, c) => (
              <div key={c} className={`h-4 rounded bg-slate-100 animate-pulse ${c === 0 ? 'w-64' : c === columns - 1 ? 'w-20 ml-auto' : 'flex-1'}`} />
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
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="bg-card rounded-card border border-dashed border-slate-300 py-16 px-6 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className="w-7 h-7 text-slate-400"
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
      <p className="mt-4 text-base font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="bg-card rounded-card border border-danger-100 py-16 px-6 text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-danger-100 flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className="w-7 h-7 text-danger-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <p className="mt-4 text-base font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{description}</p>
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
