/**
 * @qalnet/shared-types
 *
 * Single source of truth for types shared between the backend (NestJS)
 * and frontend (Next.js). Import from this package in both apps to keep
 * request/response shapes in sync automatically.
 */

// ── Auth ──────────────────────────────────────────────────────────────────────
export * from './auth';

// ── Payments ──────────────────────────────────────────────────────────────────
export * from './payments';

// ── Social / Equb ─────────────────────────────────────────────────────────────
export * from './social';

// ── Common ────────────────────────────────────────────────────────────────────
export * from './common';
