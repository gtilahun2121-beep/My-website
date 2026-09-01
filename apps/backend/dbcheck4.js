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
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='payouts' ORDER BY ordinal_position`;
    console.log('payouts cols:', cols.map(x => x.column_name).join(', '));
  } catch (e) { console.log('payouts cols ERR:', e.message); }
  try {
    const ev = await sql`SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='payout_status' ORDER BY enumsortorder`;
    console.log('payout_status:', ev.map(x => x.enumlabel).join(', '));
  } catch (e) { console.log('enum ERR:', e.message); }
  try {
    const p = await sql`SELECT id, status FROM payouts LIMIT 3`;
    console.log('payouts rows:', JSON.stringify(p));
  } catch (e) { console.log('payouts select ERR:', e.message); }
  try {
    const bc = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='payout_batch_runs'`;
    console.log('batch_runs cols:', bc.map(x => x.column_name).join(', '));
  } catch (e) { console.log('batch_runs ERR:', e.message); }
  try {
    const m = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='memberships' AND column_name='status'`;
    console.log('memberships.status exists:', m.length > 0);
  } catch (e) { console.log('memberships ERR:', e.message); }
  await sql.end();
  process.exit(0);
})().catch(async (e) => { console.log('FATAL:', e.message); try { await sql.end(); } catch {} process.exit(1); });