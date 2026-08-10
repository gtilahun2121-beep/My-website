export function formatETB(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'ETB 0';
  return `ETB ${amount.toLocaleString('en-US')}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '—';
  }
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    participant: 'Member',
    host: 'Host',
    admin: 'Admin',
  };
  return map[role] ?? 'Member';
}

export function trustTierLabel(tier: string): string {
  const map: Record<string, string> = {
    standard: 'Standard',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    verified_trust: 'Verified Trust',
  };
  return map[tier] ?? 'Standard';
}
