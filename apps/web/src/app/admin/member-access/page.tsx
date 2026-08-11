'use client';

import { EmptyState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

export default function AdminMemberAccessPage() {
  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  return (
    <EmptyState
      title="Member Access is coming soon"
      description="Controls for member permissions, access and account security will appear here."
      variant="dark"
    />
  );
}
