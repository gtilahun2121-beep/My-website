'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/app/components/admin/Sidebar';
import TopHeader from '@/app/components/admin/TopHeader';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

/**
 * Persistent Admin Console shell (Sidebar + TopHeader + main).
 *
 * Because this layout sits at /admin/*, the drawer and header stay mounted
 * across dashboard/customers/approvals/… navigation, so notifications and
 * pending-counts are fetched once instead of on every click.
 */
const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/admin/dashboard': { title: 'Dashboard', subtitle: 'Overview of the QalNet platform' },
  '/admin/member-access': { title: 'Member Access', subtitle: 'Member access, permissions and account controls' },
  '/admin/customers': { title: 'Members', subtitle: 'Manage all members on the QalNet platform' },
  '/admin/approvals': { title: 'Approvals', subtitle: 'Review Equb creation and membership join requests' },
  '/admin/kyc': { title: 'KYC Verification', subtitle: 'Identity verification workflows' },
  '/admin/finance': { title: 'Finance', subtitle: 'Financial operations, balances, payments and transactions' },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { authorized } = useRequireAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  /* Escape closes the off-canvas drawer */
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sidebarOpen, closeSidebar]);

  /* /admin is the admin sign-in page — render it without the console shell */
  if (pathname === '/admin') return <>{children}</>;

  if (!authorized) return <AdminRouteLoading />;

  const meta = PAGE_META[pathname] ?? { title: 'Admin Console', subtitle: '' };

  return (
    <div className="dark-navy min-h-screen flex text-foreground bg-admin-bg">
      <Sidebar
        variant="admin"
        open={sidebarOpen}
        onClose={closeSidebar}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          title={meta.title}
          subtitle={meta.subtitle}
          variant="admin"
          onMenuClick={() => setSidebarOpen(true)}
          menuButtonRef={menuButtonRef}
        />
        <main className="flex-1 px-4 sm:px-6 py-6 space-y-6 text-admin-text">
          {children}
        </main>
      </div>
    </div>
  );
}
