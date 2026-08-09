const postgres = require('postgres');
const dotenv = require('dotenv');
dotenv.config({ path: 'P:/Qalnet_Full_stack/Qalnetqalnet-monorepo/apps/backend/.env' });

const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 60, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const t = await sql`select current_database() as db, current_user as usr`;
    console.log('DB OK', JSON.stringify(t[0]));

    const tables = await sql`select tablename from pg_tables where schemaname='public' order by tablename`;
    console.log('TABLES:', tables.map(r => r.tablename).join(', '));

    const counts = await sql`select
      (select count(*) from users) as users,
      (select count(*) from equb_groups) as equbs,
      (select count(*) from memberships) as memberships,
      (select count(*) from wallets) as wallets,
      (select count(*) from payments) as payments,
      (select count(*) from notifications) as notifications,
      (select count(*) from credit_scores) as credit_scores`;
    console.log('COUNTS', JSON.stringify(counts[0]));

    const eq = await sql`select id, host_id, name, contribution_amount, total_rounds, current_round, status from equb_groups limit 5`;
    console.log('EQUBS', JSON.stringify(eq));

    const us = await sql`select id, phone, email, first_name, role, created_at from users limit 3`;
    console.log('USERS', JSON.stringify(us));
  } catch (e) {
    console.error('DB FAIL', e.message);
  } finally {
    await sql.end();
  }
})();
