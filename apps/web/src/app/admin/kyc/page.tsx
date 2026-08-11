'use client';

import { EmptyState } from '@/app/components/admin/States';
import { useRequireAdmin } from '@/app/hooks/useRequireAdmin';
import { AdminRouteLoading } from '@/app/components/admin/AdminGate';

export default function AdminKycPage() {
  const { authorized } = useRequireAdmin();
  if (!authorized) return <AdminRouteLoading />;

  return (
    <EmptyState
      title="KYC Verification is coming soon"
      description="Identity and KYC verification workflows will appear here."
      variant="dark"
    />
  );
}
