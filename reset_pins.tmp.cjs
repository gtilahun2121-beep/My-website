const postgres = require('postgres');
const argon2 = require('argon2');
require('dotenv').config({ path: 'P:/Qalnet_Full_stack/Qalnetqalnet-monorepo/apps/backend/.env' });
const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 60, ssl: { rejectUnauthorized: false } });
(async () => {
  try {
    const hash = await argon2.hash('1234QN1234!');
    const updated = await sql`update users set password_hash = ${hash} where phone in ('+251911223345', '+251911223346') returning id, phone`;
    console.log('Updated password hashes for:', JSON.stringify(updated));
  } catch (e) { console.error('FAIL', e.message); }
  finally { await sql.end(); }
})();
