# Database Migrations

Migrations are plain PostgreSQL SQL scripts, applied out-of-band (the app does
NOT auto-apply migrations on boot). Apply them in numeric order against the
Neon serverless Postgres database using `psql`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/backend/database/migrations/001_add_refresh_tokens.sql
# ... repeat for 002 … 014 ...
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/backend/database/migrations/015_add_daily_cycles.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/backend/database/migrations/016_add_weekly_cycles.sql
```

`DATABASE_URL` comes from the vault (see `apps/backend/src/config/vault.config.ts`).

## Migration list

| # | File | Purpose |
|---|------|---------|
| 001–014 | `*.sql` | Base schema, auth, wallet, tier-3 production, lottery events, etc. |
| 015 | `015_add_daily_cycles.sql` | Daily Equb cycles: `cycle_type` / `payment_cutoff_time` / `late_penalty_rate` / `last_cycle_date` on `equb_groups`, plus `daily_cycles` and `cycle_penalties` tables. |
| 016 | `016_add_weekly_cycles.sql` | Weekly Equb cycles: extends `equb_cycle_type` to `'weekly'` and adds `payment_cutoff_weekday` on `equb_groups`. |

## Migration 015 — Daily Equb cycles

Adds the Daily Equb model on top of the round-based engine (each operating day
maps 1:1 to a round). It is additive and non-destructive:

- New columns on `equb_groups` default existing round-mode equbs to
  `cycle_type = 'round'` with the classic draw behaviour unchanged.
- Two new tables: `daily_cycles` (one row per operating day per daily equb,
  status `open`/`closed`/`drawn`) and `cycle_penalties` (one row per member per
  missed cutoff). Neither is RLS-protected; wallet penalty debits run under an
  admin RLS context because `wallets` **is** RLS-protected.

### Runtime requirements

- The automatic daily cutoff is driven by `DailyCycleTask` (a `@nestjs/schedule`
  cron that polls every 5 minutes) and guarded by a Redlock distributed lock
  (`lock:daily-cycle:global`). This requires a reachable `REDIS_URL` in the
  vault — without Redis the cron cannot acquire the lock and daily cutoffs will
  not run automatically.
- Cutoff comparisons use the server's local timezone.

## Migration 016 — Weekly Equb cycles

Extends the periodic-cycle engine (from 015) to a Weekly cadence — one draw
every 7 days instead of every day:

- `equb_cycle_type` gains the `'weekly'` value.
- `equb_groups.payment_cutoff_weekday` (0=Sun…6=Sat, default 6) is the Day-7
  draw/cutoff day. The 6-day payment window runs on the preceding days; the
  window stays open until `payment_cutoff_time` on `payment_cutoff_weekday`.
- The `daily_cycles` / `cycle_penalties` tables from 015 are shared — they are
  cadence-agnostic, and an equb is never both daily and weekly, so weekly rows
  (dated by their cutoff day) cannot collide.

### Weekly runtime

- `WeeklyCycleTask` polls every 10 minutes and processes weekly equbs whose
  cutoff has passed (Redlock `lock:weekly-cycle:global`; requires `REDIS_URL`).
- `WeeklyReminderTask` runs once daily and dispatches window reminders (Day 1
  open, Day 4 mid-week, Day 6 final call) to approved members via in-app
  notifications.
- The weekly engine runs the standard lottery draw. The "Prime Option"
  (የእጣ ግዢ) auction/bid track is provided by the existing auction module.
- Late members are debited a penalty and locked out of that week's draw only.
