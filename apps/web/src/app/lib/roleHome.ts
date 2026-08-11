/**
 * roleHome.ts
 *
 * Single source of truth for "where does this role land after
 * signup / signin". Admins go to the admin console; everyone else
 * (members + hosts) goes to the member dashboard.
 *
 * The stored user JSON (localStorage 'qalnet_user', written by
 * AuthContext) always carries the JWT `role`, so the post-auth
 * redirect reads the role from there without waiting for React state.
 */

const STORAGE_KEY = 'qalnet_user';

export function homePathForRole(role?: string | null): string {
  return role === 'admin' ? '/admin/dashboard' : '/dashboard';
}

export function storedRole(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { role?: string | null }).role ?? null;
  } catch {
    return null;
  }
}

export function homePathForStoredUser(): string {
  return homePathForRole(storedRole());
}
