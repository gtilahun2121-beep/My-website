'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

/**
 * Route guard for /admin/* pages.
 *
 * Authenticates against the real backend session (JWT from AuthContext).
 * When the current user is not an authenticated admin, redirects to /admin
 * (the admin login page). Returns `authorized` so callers can render a
 * loading placeholder while the redirect happens.
 */
export function useRequireAdmin() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const authorized = !!user && user.role === 'admin';

  useEffect(() => {
    if (!isLoading && !authorized) {
      router.replace('/admin');
    }
  }, [isLoading, authorized, router]);

  return { authorized, isLoading };
}
