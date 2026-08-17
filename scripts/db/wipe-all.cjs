/**
 * wipe-all.cjs
 *
 * DANGER: Deletes ALL rows from every QalNet table, in dependency order
 * (children before parents) so the ON DELETE RESTRICT constraints are
 * respected. This is a full data wipe — users, equbs, payments, wallets,
 * notifications, everything.
 *
 * Usage:  node scripts/db/wipe-all.cjs
 *
 * It runs inside a single transaction; if anything fails, nothing is deleted.
 */

const postgres = require('postgres');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../../apps/backend/.env') });

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 60,
  ssl: { rejectUnauthorized: false },
});

// Tables referencing users/equbs with ON DELETE RESTRICT must be cleared
// before their parents. Order matters — children first.
// user_settings has user_id as its PRIMARY KEY (no id column), so it uses
// a bare DELETE without RETURNING.
const TABLES_IN_ORDER = [
  ['audit_logs', true],
  ['crb_blacklists', true],
  ['reconciliation_tickets', true],
  ['payments', true],
  ['lottery_draws', true],
  ['payout_slot_trades', true],
  ['social_votes', true],
  ['social_proposals', true],
  ['payout_batches', true],
  ['multisig_approvals', true],
  ['payouts', true],
  ['memberships', true],
  ['equb_groups', true],
  ['notifications', true],
  ['user_settings', false],
  ['refresh_tokens', true],
  ['wallet_transactions', true],
  ['wallets', true],
  ['credit_scores', true],
  ['equb_creation_requests', true],
  ['pin_reset_codes', true],
  ['ussd_sessions', true],
  ['fee_config', true],
  ['users', true],
];

(async () => {
  try {
    const pre = await sql`
      select (select count(*) from users) as users,
             (select count(*) from equb_groups) as equbs,
             (select count(*) from wallets) as wallets,
             (select count(*) from payments) as payments
    `;
    console.log('BEFORE:', JSON.stringify(pre[0]));

    await sql.begin(async (tx) => {
      for (const [table, hasId] of TABLES_IN_ORDER) {
        let count;
        if (hasId) {
          const res = await tx`
            delete from ${tx(table)} returning id
          `;
          count = res.length;
        } else {
          const res = await tx`
            delete from ${tx(table)}
          `;
          count = res.count;
        }
        console.log(`  cleared ${table}: ${count} rows`);
      }
    });

    const post = await sql`
      select (select count(*) from users) as users,
             (select count(*) from equb_groups) as equbs,
             (select count(*) from wallets) as wallets,
             (select count(*) from payments) as payments
    `;
    console.log('AFTER :', JSON.stringify(post[0]));
    console.log('WIPE COMPLETE — all data removed.');
  } catch (e) {
    console.error('WIPE FAILED, nothing was changed:', e.message);
  } finally {
    await sql.end();
  }
})();