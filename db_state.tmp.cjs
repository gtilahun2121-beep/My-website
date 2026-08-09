const postgres = require('postgres');
require('dotenv').config({ path: 'P:/Qalnet_Full_stack/Qalnetqalnet-monorepo/apps/backend/.env' });
const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 60, ssl: { rejectUnauthorized: false } });
(async () => {
  try {
    const users = await sql`select id, first_name, last_name, phone, email, role from users order by created_at`;
    console.log('USERS', JSON.stringify(users));
    const equbs = await sql`select id, host_id, name, contribution_amount, total_amount, cycle_days, total_rounds, current_round, status from equb_groups order by created_at`;
    console.log('EQUB_GROUPS', JSON.stringify(equbs));
    const wallets = await sql`select id, user_id, balance, currency from wallets`;
    console.log('WALLETS', JSON.stringify(wallets));
    const memberships = await sql`select user_id, equb_id, joined_at from memberships`;
    console.log('MEMBERSHIPS', JSON.stringify(memberships));
    const payments = await sql`select id, user_id, equb_id, round_number, amount, payment_status from payments`;
    console.log('PAYMENTS', JSON.stringify(payments));
    const payouts = await sql`select id, equb_id, round_number, winner_id, total_pot_amount, status from payouts`;
    console.log('PAYOUTS', JSON.stringify(payouts));
  } catch (e) { console.error('FAIL', e.message); }
  finally { await sql.end(); }
})();
