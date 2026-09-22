import type { Notification } from '@qalnet/shared-types';

const CATEGORY_TONE: Record<Notification['category'], { iconBg: string; text: string }> = {
  operational: { iconBg: 'bg-brand-100', text: 'text-brand-700' },
  social_trust: { iconBg: 'bg-accent-100', text: 'text-accent-600' },
  system_policy: { iconBg: 'bg-warning-100', text: 'text-warning-700' },
};

interface ImportantAlertsProps {
  notifications: Notification[];
}

export default function ImportantAlerts({ notifications }: ImportantAlertsProps) {
  const unread = notifications.filter((n) => !n.is_read).slice(0, 4);

  if (unread.length === 0) return null;

  return (
    <section className="bg-card rounded-card border border-gray-200">
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-base font-black text-[#0066ff]">Important Alerts</h2>
      </div>

      <div className="px-4 pb-3 space-y-2">
        {unread.map((n) => {
          const tone = CATEGORY_TONE[n.category] ?? CATEGORY_TONE.operational;
          return (
            <div
              key={n.id}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tone.iconBg}`}>
                <svg
                  viewBox="0 0 24 24"
                  className={`w-4 h-4 ${tone.text}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#0066ff]">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{n.body}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
