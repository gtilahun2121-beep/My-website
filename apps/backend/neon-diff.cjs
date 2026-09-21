const { Pool } = require('pg');
const url = process.env.NEON_URL;
const p = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
p.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename", (e, r) => {
  if (e) { console.error('FAIL:', e.message); process.exit(1); }
  const local = ['audit_logs','crb_blacklists','credit_scores','cycle_penalties','daily_cycles','equb_bids','equb_creation_requests','equb_groups','equb_preset_templates','fcfs_payment_order','fee_config','lottery_draws','lottery_events','memberships','multisig_approvals','notifications','payments','payout_batch_runs','payout_batches','payout_slot_trades','payouts','pin_reset_codes','reconciliation_issues','reconciliation_runs','reconciliation_tickets','refresh_tokens','social_proposals','social_votes','user_settings','users','ussd_sessions','wallet_transactions','wallets','webhook_events'];
  const neon = r.rows.map(x => x.tablename);
  console.log('NEON tables (' + neon.length + '): ' + neon.join(', '));
  const missing = local.filter(t => !neon.includes(t));
  const extra = neon.filter(t => !local.includes(t));
  console.log('MISSING from Neon: ' + (missing.join(', ') || '(none)'));
  console.log('EXTRA on Neon: ' + (extra.join(', ') || '(none)'));
  p.end();
});