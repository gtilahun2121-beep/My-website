const { Pool } = require('pg');
const url = process.env.NEON_URL;
const p = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const tables = ['users','wallets','memberships','equb_groups','payments','equb_formats','refresh_tokens','notifications','payouts','audit_logs','lottery_draws','wallet_transactions','equb_bids','reconciliation_tickets','social_proposals','crb_blacklists','pin_reset_codes','user_settings','multisig_approvals','fee_config','payout_batches','payout_slot_trades','credit_scores','ussd_sessions'];
(async () => {
  const client = await p.connect();
  const q = (s) => client.query(s).then(r => r);
  const results = [];
  for (const t of tables) {
    try { const r = await q(`select count(*) as c from "${t}"`); results.push(`${t}: ${r.rows[0].c}`); }
    catch (e) { results.push(`${t}: ERR ${e.message.split('\n')[0]}`); }
  }
  console.log(results.join('\n'));
  await client.end(); await p.end();
})();