'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sidebar, { type ShellVariant } from './Sidebar';
import TopHeader from './TopHeader';

interface AppShellProps {
  title: string;
  subtitle?: string;
  variant?: ShellVariant;
  children: React.ReactNode;
}

export default function AppShell({ title, subtitle, variant = 'admin', children }: AppShellProps) {
  const isAdmin = variant === 'admin';

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

  return (
    <div
      className={`dark-navy min-h-screen flex text-foreground ${
        isAdmin ? 'bg-admin-bg' : 'bg-surface'
      }`}
    >
      <Sidebar
        variant={variant}
        open={sidebarOpen}
        onClose={closeSidebar}
        collapsed={isAdmin ? collapsed : false}
        onToggleCollapsed={isAdmin ? () => setCollapsed((v) => !v) : undefined}
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
          title={title}
          subtitle={subtitle}
          variant={variant}
          onMenuClick={() => setSidebarOpen(true)}
          menuButtonRef={menuButtonRef}
        />
        <main
          className={`flex-1 px-4 sm:px-6 py-4 space-y-4 ${
            isAdmin ? 'text-admin-text' : ''
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
