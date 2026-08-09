const postgres = require('postgres');
require('dotenv').config({ path: 'P:/Qalnet_Full_stack/Qalnetqalnet-monorepo/apps/backend/.env' });
const fs = require('fs');
const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 60, ssl: { rejectUnauthorized: false } });
(async () => {
  try {
    const existing = await sql`select to_regclass('public.wallet_transactions') as t`;
    console.log('wallet_transactions before:', existing[0].t);
    if (existing[0].t === null) {
      const sqlText = fs.readFileSync('P:/Qalnet_Full_stack/Qalnetqalnet-monorepo/apps/backend/database/migrations/003_add_wallet_transactions.sql', 'utf8');
      await sql.unsafe(sqlText);
      console.log('Migration 003 applied.');
    } else {
      console.log('Migration 003 already present, skipping.');
    }
    const cols = await sql`select column_name, data_type from information_schema.columns where table_name = 'wallet_transactions' order by ordinal_position`;
    console.log('wallet_transactions columns:', JSON.stringify(cols));
  } catch (e) { console.error('FAIL', e.message); }
  finally { await sql.end(); }
})();
