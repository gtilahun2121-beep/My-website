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
  const userId = '8b61f0f2-83b6-45a7-9dd8-ad30d582a7b2';

  // use a real equb id if any exist
  let equbId = '00000000-0000-0000-0000-000000000000';
  try {
    const eq = await sql`SELECT id FROM equb_groups LIMIT 1`;
    if (eq.length) equbId = eq[0].id;
    console.log('using equb_id:', equbId);
  } catch (e) { console.log('equb lookup ERR:', e.message); }

  try {
    await withRls(userId, 'participant', async (tx) => {
      const rows = await tx`SELECT * FROM payments WHERE equb_id = ${equbId} AND round_number = ${1} AND payment_status = 'pending'`;
      console.log('payments pending (real uuid) OK rows=', rows.length);
    });
  } catch (e) { console.log('payments pending ERR:', e.message); }

  await sql.end();
  process.exit(0);
})().catch(async (e) => { console.log('FATAL:', e.message); try { await sql.end(); } catch {} process.exit(1); });