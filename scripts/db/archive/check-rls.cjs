const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../apps/backend/.env') });
const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 60, ssl: { rejectUnauthorized: false } });
(async () => {
  try {
    const role = await sql`select current_user as usr, (select rolsuper from pg_roles where rolname = current_user) as super, (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls`;
    console.log('ROLE', JSON.stringify(role[0]));
    const rls = await sql`select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('users','wallets','payments')`;
    console.log('RLS', JSON.stringify(rls));
    const pol = await sql`select tablename, policyname, cmd from pg_policies where schemaname='public' order by tablename, cmd`;
    console.log('POLICIES', JSON.stringify(pol));
    const owners = await sql`select c.relname, r.rolname as owner from pg_class c join pg_roles r on r.oid = c.relowner where c.relname in ('users','wallets','payments')`;
    console.log('OWNERS', JSON.stringify(owners));
  } catch (e) { console.error('FAIL', e.message); }
  finally { await sql.end(); }
})();
