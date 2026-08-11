'use client';

import { useState } from 'react';
import Sidebar, { type ShellVariant } from './Sidebar';
import TopHeader from './TopHeader';

interface AppShellProps {
  title: string;
  subtitle?: string;
  variant?: ShellVariant;
  children: React.ReactNode;
}

export default function AppShell({ title, subtitle, variant = 'admin', children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = variant === 'admin';

  return (
    <div
      className={`min-h-screen flex text-foreground ${
        isAdmin ? 'bg-admin-bg' : 'bg-surface'
      }`}
    >
      <Sidebar variant={variant} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          title={title}
          subtitle={subtitle}
          variant={variant}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main
          className={`flex-1 px-4 sm:px-6 py-6 space-y-6 ${
            isAdmin ? 'text-admin-text' : ''
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
