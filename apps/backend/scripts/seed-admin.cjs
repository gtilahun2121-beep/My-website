/**
 * seed-admin.cjs
 *
 * Seeds (or resets) the QalNet admin user in the Neon database.
 * The seeded PIN is hashed with Argon2id + the ARGON2_PEPPER exactly like
 * the registration flow, so the admin can log in through the normal
 * /auth/login endpoint with the 4-digit PIN.
 *
 * Only one admin remains after seeding: every other user is demoted
 * to 'participant' so Danel Temesgen is the sole administrator.
 *
 * Usage:
 *   node apps/backend/scripts/seed-admin.cjs
 *
 * Overrides via env (defaults shown):
 *   ADMIN_SEED_EMAIL  danel@qalnet.com
 *   ADMIN_SEED_PHONE  +251904556677
 *   ADMIN_SEED_PIN    4488            (raw 4-digit PIN; padded internally)
 *   ADMIN_SEED_FIRST  Danel
 *   ADMIN_SEED_LAST   Temesgen
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const postgres = require('postgres');
const argon2 = require('argon2');

// Load .env in the SAME precedence order as apps/backend/src/main.ts:
// apps/backend/.env wins over the monorepo root .env (dotenv does not
// override already-set variables). Seeding must use the pepper + DB that
// the running backend actually reads.
for (const file of [
    path.resolve(__dirname, '../.env'),      // apps/backend/.env
    path.resolve(__dirname, '../../../.env'), // monorepo root .env
]) {
    if (fs.existsSync(file)) dotenv.config({ path: file });
}
dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || 'danel@qalnet.com';
const ADMIN_PHONE = process.env.ADMIN_SEED_PHONE || '+251904556677';
const ADMIN_PIN = process.env.ADMIN_SEED_PIN || '4488';
const ADMIN_FIRST = process.env.ADMIN_SEED_FIRST || 'Danel';
const ADMIN_LAST = process.env.ADMIN_SEED_LAST || 'Temesgen';

// Mirrors padPin() in the web app: "1234" -> "1234QN1234!"
const PADDED_PIN = `${ADMIN_PIN}QN${ADMIN_PIN}!`;

// Mirrors ARGON2_OPTIONS in auth.service.ts
const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
    saltLength: 16,
};

async function main() {
    if (!process.env.DATABASE_URL || !process.env.ARGON2_PEPPER) {
        throw new Error('DATABASE_URL and ARGON2_PEPPER must be set (checked .env).');
    }

    const sql = postgres(process.env.DATABASE_URL, { max: 1 });
    try {
        const passwordHash = await argon2.hash(
            PADDED_PIN + process.env.ARGON2_PEPPER,
            ARGON2_OPTIONS,
        );

        const [user] = await sql`
            INSERT INTO users (first_name, last_name, phone, email, password_hash, role, is_active)
            VALUES (${ADMIN_FIRST}, ${ADMIN_LAST}, ${ADMIN_PHONE}, ${ADMIN_EMAIL}, ${passwordHash}, 'admin', TRUE)
            ON CONFLICT (email) DO UPDATE SET
                role         = 'admin',
                is_active    = TRUE,
                first_name   = EXCLUDED.first_name,
                last_name    = EXCLUDED.last_name,
                phone        = EXCLUDED.phone,
                password_hash = EXCLUDED.password_hash,
                updated_at   = NOW()
            RETURNING id, first_name, last_name, email, phone, role, is_active, created_at
        `;

        await sql`INSERT INTO wallets (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;
        await sql`INSERT INTO credit_scores (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;
        await sql`INSERT INTO user_settings (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;

        const demoted = await sql`
            UPDATE users
            SET role = 'participant', updated_at = NOW()
            WHERE role = 'admin' AND id <> ${user.id}
        `;

        console.log('Admin seeded/reset:');
        console.log('  name  :', `${user.first_name} ${user.last_name}`);
        console.log('  email :', user.email);
        console.log('  phone :', user.phone);
        console.log('  role  :', user.role);
        console.log('  active:', user.is_active);
        console.log(`Login with PIN ${ADMIN_PIN} via POST /api/v1/auth/login`);
        console.log('Other admins demoted to participant:', demoted.count);
    } finally {
        await sql.end();
    }
}

main().catch((err) => {
    console.error('[seed-admin] FAILED:', err);
    process.exit(1);
});
