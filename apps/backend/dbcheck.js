const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.resolve(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.log('no DATABASE_URL'); process.exit(1); }
const url = m[1].trim().replace(/^"|"$/g, '');
const sql = postgres(url, { ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const payoutsCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='payouts' ORDER BY ordinal_position`;
    console.log('payouts cols:', payoutsCols.map(x => x.column_name).join(', '));
  } catch (e) { console.log('payouts cols ERR:', e.message); }

  try {
    const enumVals = await sql`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='payout_status'`;
    console.log('payout_status enum:', enumVals.map(x => x.enumlabel).join(', '));
  } catch (e) { console.log('enum ERR:', e.message); }

  try {
    const payouts = await sql`SELECT id, status FROM payouts LIMIT 3`;
    console.log('payouts sample:', JSON.stringify(payouts));
  } catch (e) { console.log('payouts SELECT ERR:', e.message); }

  try {
    const payments = await sql`SELECT id, status FROM payments LIMIT 3`;
    console.log('payments sample:', JSON.stringify(payments));
  } catch (e) { console.log('payments SELECT ERR:', e.message); }

  try {
    const batchCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='payout_batch_runs' ORDER BY ordinal_position`;
    console.log('payout_batch_runs cols:', batchCols.map(x => x.column_name).join(', '));
  } catch (e) { console.log('batch_runs ERR:', e.message); }

  try {
    const paymentsCols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='payments' ORDER BY ordinal_position`;
    console.log('payments cols:', paymentsCols.map(x => x.column_name).join(', '));
  } catch (e) { console.log('payments cols ERR:', e.message); }

  await sql.end();
  process.exit(0);
})().catch(async (e) => { console.log('FATAL:', e.message); try { await sql.end(); } catch {} process.exit(1); });