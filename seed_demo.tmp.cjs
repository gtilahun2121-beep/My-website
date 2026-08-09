const postgres = require('postgres');
require('dotenv').config({ path: 'P:/Qalnet_Full_stack/Qalnetqalnet-monorepo/apps/backend/.env' });
const sql = postgres(process.env.DATABASE_URL, { connect_timeout: 60, ssl: { rejectUnauthorized: false } });

const USER1 = '93aa4e19-cddd-4405-a954-3cf0992deb48';
const USER2 = '2501febf-bbbd-4c9b-9643-40eeecc881c0';

(async () => {
  try {
    await sql.begin(async (tx) => {
    await tx`delete from wallet_transactions`;
    await tx`delete from payouts`;
    await tx`delete from payments`;
    await tx`delete from memberships`;
    await tx`delete from equb_groups`;
    console.log('cleaned old demo rows');

    const [eA] = await tx`
      insert into equb_groups (host_id, name, description, total_amount, contribution_amount, cycle_days, total_rounds, current_round, status)
      values (${USER1}, 'Gold Savings Circle', 'Monthly savings circle with guaranteed rotation.', 10000, 1000, 30, 10, 3, 'active')
      returning id`;
    const [eB] = await tx`
      insert into equb_groups (host_id, name, description, total_amount, contribution_amount, cycle_days, total_rounds, current_round, status)
      values (${USER1}, 'Friends Investment Equb', 'Long-term investment pool for friends.', 30000, 2500, 30, 12, 2, 'active')
      returning id`;
    const [eC] = await tx`
      insert into equb_groups (host_id, name, description, total_amount, contribution_amount, cycle_days, total_rounds, current_round, status)
      values (${USER1}, 'Weekly Market Traders', 'Fast weekly rotation for small-scale traders.', 4000, 500, 7, 8, 0, 'open')
      returning id`;
    console.log('equbs created', eA.id, eB.id, eC.id);

    await tx`insert into memberships (user_id, equb_id) values
      (${USER1}, ${eA.id}), (${USER2}, ${eA.id}),
      (${USER1}, ${eB.id}), (${USER2}, ${eB.id}),
      (${USER1}, ${eC.id})`;

    // Paid contributions for the active rounds already run
    for (const r of [1, 2, 3]) {
      await tx`insert into payments (user_id, equb_id, round_number, amount, payment_status, transaction_reference, paid_at) values
        (${USER1}, ${eA.id}, ${r}, 1000, 'paid', ${'PAY-A-' + r + '-u1'}, now() - ((${3 - r}) || ' months')::interval),
        (${USER2}, ${eA.id}, ${r}, 1000, 'paid', ${'PAY-A-' + r + '-u2'}, now() - ((${3 - r}) || ' months')::interval)`;
    }
    for (const r of [1, 2]) {
      await tx`insert into payments (user_id, equb_id, round_number, amount, payment_status, transaction_reference, paid_at) values
        (${USER1}, ${eB.id}, ${r}, 2500, 'paid', ${'PAY-B-' + r + '-u1'}, now() - ((${2 - r}) || ' months')::interval),
        (${USER2}, ${eB.id}, ${r}, 2500, 'paid', ${'PAY-B-' + r + '-u2'}, now() - ((${2 - r}) || ' months')::interval)`;
    }
    console.log('payments seeded');

    // Rotation payouts: round pot = contribution * members
    await tx`insert into payouts (equb_id, round_number, winner_id, total_pot_amount, status, created_at) values
      (${eA.id}, 1, ${USER2}, 2000, 'completed', now() - interval '3 months'),
      (${eA.id}, 2, ${USER1}, 2000, 'completed', now() - interval '2 months'),
      (${eA.id}, 3, ${USER2}, 2000, 'completed', now() - interval '1 month'),
      (${eB.id}, 1, ${USER1}, 5000, 'completed', now() - interval '2 months'),
      (${eB.id}, 2, ${USER2}, 5000, 'completed', now() - interval '1 month')`;
    console.log('payouts seeded');

    // Wallet balances
    await tx`update wallets set balance = 6500 where user_id = ${USER1}`;
    await tx`update wallets set balance = 4500 where user_id = ${USER2}`;

    // Wallet ledger (deposits / withdrawals)
    await tx`insert into wallet_transactions (user_id, direction, amount, reference) values
      (${USER1}, 'deposit', 10000, 'DEP-DEMO-INITIAL-01'),
      (${USER1}, 'withdrawal', 2500, 'WDR-telebirr-DEMO-01'),
      (${USER1}, 'withdrawal', 1000, 'WDR-CBE-DEMO-02'),
      (${USER2}, 'deposit', 8000, 'DEP-DEMO-INITIAL-02'),
      (${USER2}, 'withdrawal', 3500, 'WDR-telebirr-DEMO-03')`;
    console.log('wallet ledger seeded');
    });
    console.log('SEED COMPLETE');
  } catch (e) {
    console.error('SEED FAIL', e.message);
  } finally {
    await sql.end();
  }
})();
