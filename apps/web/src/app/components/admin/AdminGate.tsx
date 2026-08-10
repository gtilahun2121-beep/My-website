'use client';

export function AdminRouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-admin-bg">
      <div className="flex items-center gap-3 text-admin-muted" aria-busy="true">
        <div className="w-5 h-5 rounded-full border-2 border-admin-border-strong border-t-brand-500 animate-spin" />
        <p className="text-sm font-semibold">Verifying admin access…</p>
      </div>
    </div>
  );
}
