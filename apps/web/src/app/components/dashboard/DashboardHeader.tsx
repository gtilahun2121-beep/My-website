import Link from 'next/link';

interface DashboardHeaderProps {
  firstName: string;
  isNewUser?: boolean;
}

export default function DashboardHeader({ firstName, isNewUser }: DashboardHeaderProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
          {greeting}, {firstName || 'there'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isNewUser
            ? 'Welcome to QalNet. Join your first Equb to start saving with your community.'
            : "Here's what's happening with your Equbs today."}
        </p>
      </div>

      <Link
        href="/join-equb"
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 transition-colors shrink-0"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14m-7-7h14" />
        </svg>
        Join an Equb
      </Link>
    </div>
  );
}
