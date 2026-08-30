const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.resolve(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.log('no DATABASE_URL'); process.exit(1); }
const url = m[1].trim().replace(/^"|"$/g, '');
const sql = postgres(url, { ssl: { rejectUnauthorized: false } });

async function withRls(userId, role, fn) {
  return sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_user_id', ${userId}, true)`;
    await tx`SELECT set_config('app.current_user_role', ${role}, true)`;
    return fn(tx);
  });
}

(async () => {
  const userId = '8b61f0f2-83b6-45a7-9dd8-ad30d582a7b2'; // our test user

  // payments repo query
  try {
    await withRls(userId, 'participant', async (tx) => {
      const rows = await tx`SELECT * FROM payments WHERE equb_id = ${'nonexistent'} AND round_number = ${1} AND payment_status = 'pending'`;
      console.log('payments getPendingPaymentsForRound OK rows=', rows.length);
    });
  } catch (e) { console.log('payments getPendingPaymentsForRound ERR:', e.message); }

  // payouts listPayouts query (exact columns from repo)
  try {
    await withRls(userId, 'participant', async (tx) => {
      const rows = await tx`SELECT id, equb_id, round_number, winner_id, total_pot_amount, status,
             provider, transaction_reference, requested_at, completed_at,
             failure_reason, created_at, updated_at
      FROM payouts
      ORDER BY created_at DESC
      LIMIT 500`;
      console.log('payouts listPayouts OK rows=', rows.length);
    });
  } catch (e) { console.log('payouts listPayouts ERR:', e.message); }

  // payout_batch_runs createPayoutBatchRun query
  try {
    await withRls(userId, 'participant', async (tx) => {
      const rows = await tx`INSERT INTO payout_batch_runs (provider, total_amount, total_payouts, status)
      VALUES ('sandbox-bank', 100, 1, 'processing')
      RETURNING id, provider, total_amount, total_payouts, status, created_at, completed_at`;
      console.log('createPayoutBatchRun OK:', JSON.stringify(rows));
    });
  } catch (e) { console.log('createPayoutBatchRun ERR:', e.message); }

  await sql.end();
  process.exit(0);
})().catch(async (e) => { console.log('FATAL:', e.message); try { await sql.end(); } catch {} process.exit(1); });