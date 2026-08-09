const path = require('path');
const fs = require('fs');

const BACKEND_NM = path.resolve(__dirname, 'node_modules');
const dotenv = require(path.join(BACKEND_NM, 'dotenv'));
const postgres = require(path.join(BACKEND_NM, 'postgres'));

const rootEnv = path.resolve(__dirname, '.env');
const backendEnv = path.resolve(__dirname, 'apps/backend/.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
if (fs.existsSync(backendEnv)) dotenv.config({ path: backendEnv });

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing — is .env present?');

  const sql = postgres(url, {
    ssl: { rejectUnauthorized: false },
    max: 1,
    connect_timeout: 60,
    onnotice: () => {},
  });

  const m005 = fs.readFileSync(
    path.resolve(__dirname, 'apps/backend/database/migrations/005_add_user_settings.sql'), 'utf8');
  const m006 = fs.readFileSync(
    path.resolve(__dirname, 'apps/backend/database/migrations/006_add_efficiency_indexes.sql'), 'utf8');

  for (const [name, script] of [
    ['005_add_user_settings', m005],
    ['006_add_efficiency_indexes', m006],
  ]) {
    await sql.begin(async (tx) => {
      await tx.unsafe(script);
    });
    console.log(`Applied ${name}`);
  }

  // Cleanup: idx_refresh_tokens_expires already covered expiry lookups
  await sql`DROP INDEX IF EXISTS idx_refresh_tokens_expiry`;
  console.log('dropped idx_refresh_tokens_expiry (redundant)');

  const cols = await sql`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'user_settings'
    ORDER BY ordinal_position`;
  console.log('user_settings:', JSON.stringify(cols, null, 2));

  const idx = await sql`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE tablename IN ('user_settings','notifications','memberships','equb_groups',
                        'payouts','payments','refresh_tokens','lottery_draws','audit_logs')
    ORDER BY tablename, indexname`;
  console.log('indexes:', JSON.stringify(idx, null, 2));

  const rls = await sql`
    SELECT tablename, policyname
    FROM pg_policies
    WHERE tablename = 'user_settings'`;
  console.log('user_settings policies:', JSON.stringify(rls, null, 2));

  await sql.end();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
