import Link from 'next/link';

export default function HelpCard() {
  return (
    <section className="rounded-card bg-gradient-to-br from-brand-700 to-brand-600 text-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black">Need help?</h2>
        <p className="hidden sm:block text-xs text-brand-100 max-w-[14rem]">
          Support is ready for your Equbs, payments and account questions.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Link
          href="/security"
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-xs font-bold hover:bg-gray-200 transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13.5L17 17l-3 3-3-3-3 3-4 1.5Z" />
          </svg>
          Help Center
        </Link>
        <button
          type="button"
          title="Coming soon"
          disabled
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-xs font-bold opacity-60 cursor-not-allowed"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 9h8m-8 4h5m-2.6 8L12 21c-4.4 0-8-3.6-8-8a7 7 0 1 1 14 0c0 3-1.9 5.5-4.6 6.4Z" />
          </svg>
          Live Chat
        </button>
        <button
          type="button"
          title="Coming soon"
          disabled
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-xs font-bold opacity-60 cursor-not-allowed"
        >
          <svg
            viewBox="0 0 24 24"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          Report Issue
        </button>
      </div>
    </section>
  );
}
