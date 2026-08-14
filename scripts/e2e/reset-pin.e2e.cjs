/**
 * reset-pin.e2e.cjs
 *
 * End-to-end test for the Admin "Reset PIN" flow, running against the REAL
 * application (live backend + real Postgres via the real auth endpoints).
 *
 * What it proves:
 *   1. An admin can reset a real customer's PIN via POST /api/v1/admin/users/:id/reset-pin.
 *   2. The reset clears the escalating login lockout (3 wrong PINs → stage 1).
 *   3. The NEW PIN logs in through the real /auth/login endpoint; the OLD PIN no longer works.
 *   4. Non-admins (participant JWT) get 403; unauthenticated callers get 401.
 *   5. Reset of a non-existent user returns 404.
 *
 * No fake/mock data is left behind: a throwaway admin + throwaway customer are
 * created through real flows (SQL insert for the admin, the real register
 * endpoint for the customer) and both are deleted in the cleanup step.
 *
 * Usage:
 *   node scripts/e2e/reset-pin.e2e.cjs
 *
 * Env (optional):
 *   BASE_URL        default http://localhost:4000/api/v1
 *   E2E_ADMIN_PIN   PIN for the throwaway admin (default 9999)
 */
'use strict';

const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BACKEND = path.join(ROOT, 'apps', 'backend');

// The backend's own dependencies power this script so we hash/verify with the
// exact same Argon2id options and read the same .env secrets the app uses.
// They are hoisted to the monorepo root node_modules (npm workspaces).
const dotenv = require('dotenv');
const argon2 = require('argon2');
const { Pool } = require('pg');

dotenv.config({ path: path.join(BACKEND, '.env') });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4000/api/v1';
const ARGON2_PEPPER = process.env.ARGON2_PEPPER;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  saltLength: 16,
};

// Mirrors the frontend padPin() in apps/web/src/app/services/api.ts
function padPin(pin) {
  if (pin.length >= 8 && /[A-Za-z]/.test(pin)) return pin;
  return `${pin}QN${pin}!`;
}

const randDigits = (n) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

const now = Date.now();
const ADMIN = {
  phone: `+2519${randDigits(8)}`,
  email: `e2e-admin-${now}@qalnet.test`,
  first_name: 'E2E',
  last_name: 'Admin',
  fayda_id: randDigits(16),
  pin: process.env.E2E_ADMIN_PIN ?? '9999',
};
const CUSTOMER = {
  phone: `+2519${randDigits(8)}`,
  email: `e2e-customer-${now}@qalnet.test`,
  first_name: 'E2E',
  last_name: 'Customer',
  fayda_id: randDigits(16),
  oldPin: '1122',
  newPin: '3344',
  wrongPin: '0000',
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Tiny assertion harness ───────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function assert(name, ok, detail) {
  if (!ok) {
    console.error(`FATAL: ${name}${detail ? ` — ${detail}` : ''}`);
    throw new Error(`Fatal assertion failed: ${name}`);
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function http(method, urlPath, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const register = (overrides = {}) =>
  http('POST', '/auth/register', {
    body: {
      phone: CUSTOMER.phone,
      email: CUSTOMER.email,
      first_name: CUSTOMER.first_name,
      last_name: CUSTOMER.last_name,
      fayda_id: CUSTOMER.fayda_id,
      password: padPin(CUSTOMER.oldPin),
      ...overrides,
    },
  });

const login = (identifier, pin) =>
  http('POST', '/auth/login', {
    body: { identifier, password: padPin(pin) },
  });

// ── DB helpers ───────────────────────────────────────────────────────────────
async function insertAdmin() {
  const hash = await argon2.hash(padPin(ADMIN.pin) + ARGON2_PEPPER, ARGON2_OPTIONS);
  const { rows } = await pool.query(
    `INSERT INTO users (phone, email, password_hash, first_name, last_name, fayda_id, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, 'admin', TRUE)
     RETURNING id`,
    [ADMIN.phone, ADMIN.email, hash, ADMIN.first_name, ADMIN.last_name, ADMIN.fayda_id],
  );
  ADMIN.id = rows[0].id;
}

async function lockoutFields(userId) {
  const { rows } = await pool.query(
    'SELECT failed_login_attempts, lockout_stage, locked_until FROM users WHERE id = $1',
    [userId],
  );
  return rows[0] ?? null;
}

async function deleteUserCascade(userId) {
  // Delete every table with a foreign key pointing at users, then the user row.
  const { rows } = await pool.query(
    `SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
     FROM pg_constraint c
     JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass`,
  );
  for (const ref of rows) {
    try {
      await pool.query(
        `DELETE FROM "${ref.table_name.replace(/"/g, '""')}" WHERE "${ref.column_name.replace(/"/g, '""')}" = $1`,
        [userId],
      );
    } catch (err) {
      console.warn(`  [cleanup] skipping ${ref.table_name}: ${err.message}`);
    }
  }
  await pool.query('DELETE FROM audit_logs WHERE row_id = $1 OR performed_by = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function cleanup() {
  console.log('\n── Cleanup ──');
  if (ADMIN.id) {
    await deleteUserCascade(ADMIN.id);
    console.log('  Removed throwaway admin.');
  }
  if (CUSTOMER.id) {
    await deleteUserCascade(CUSTOMER.id);
    console.log('  Removed throwaway customer.');
  }
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM users WHERE id = ANY($1)',
    [[ADMIN.id, CUSTOMER.id].filter(Boolean)],
  );
  check('Cleanup removed all throwaway records from the DB', rows[0].n === 0);
}

// ── The test ─────────────────────────────────────────────────────────────────
async function main() {
  assert('ARGON2_PEPPER is configured', Boolean(ARGON2_PEPPER), 'apps/backend/.env must define ARGON2_PEPPER');

  // 0. Probe — the live backend must be reachable.
  console.log(`Probing live backend at ${BASE_URL} …`);
  const probe = await http('POST', '/auth/check-availability', { body: {} });
  assert('Backend is reachable (check-availability responds)', probe.status === 400,
    `expected 400 for an empty availability check, got ${probe.status} — is the backend running?`);

  // 1. Provision the throwaway admin (real hash, real DB row).
  console.log('\n── Setup ──');
  await insertAdmin();
  console.log(`  Admin created: ${ADMIN.email} (${ADMIN.id})`);

  // 2. Create a real customer through the real register endpoint.
  const reg = await register();
  assert('Customer registered via real /auth/register', reg.status === 201,
    `expected 201, got ${reg.status}: ${JSON.stringify(reg.data)}`);
  CUSTOMER.id = reg.data.access_token
    ? JSON.parse(Buffer.from(reg.data.access_token.split('.')[1], 'base64url').toString()).sub
    : null;
  assert('Customer has a real user id', Boolean(CUSTOMER.id));
  CUSTOMER.accessToken = reg.data.access_token;
  console.log(`  Customer created: ${CUSTOMER.email} (${CUSTOMER.id})`);

  // 3. Admin logs in through the real login endpoint.
  console.log('\n── Flow ──');
  const adminLogin = await login(ADMIN.email, ADMIN.pin);
  check('Admin login via real /auth/login', adminLogin.status === 200,
    `expected 200, got ${adminLogin.status}`);
  const adminToken = adminLogin.data?.access_token;
  assert('Admin login returned an access token', Boolean(adminToken));

  // 4. Lock the customer with 3 wrong PINs (real login endpoint).
  let locked = false;
  for (let i = 1; i <= 3; i++) {
    const attempt = await login(CUSTOMER.email, CUSTOMER.wrongPin);
    if (attempt.status === 401 && i === 3) locked = true;
  }
  check('3 wrong PINs lock the account (3rd attempt → 401 lockout)', locked);
  const lockedState = await lockoutFields(CUSTOMER.id);
  check('DB lockout state set after 3 wrong PINs',
    lockedState && lockedState.lockout_stage === 1 && lockedState.failed_login_attempts === 0,
    JSON.stringify(lockedState));
  check('Account is time-locked (locked_until in the future)',
    Boolean(lockedState?.locked_until && new Date(lockedState.locked_until) > new Date()));

  // 5. Admin resets the PIN (the feature under test).
  const reset = await http('POST', `/admin/users/${CUSTOMER.id}/reset-pin`, {
    token: adminToken,
    body: { new_pin: padPin(CUSTOMER.newPin) },
  });
  check('Admin reset-pin returns 201', reset.status === 201, `got ${reset.status}: ${JSON.stringify(reset.data)}`);
  check('reset-pin reports success and targets the right user',
    reset.data?.success === true && reset.data?.user?.id === CUSTOMER.id,
    JSON.stringify(reset.data));

  // 6. Lockout must be cleared by the reset.
  const afterReset = await lockoutFields(CUSTOMER.id);
  check('Reset cleared failed_login_attempts', afterReset?.failed_login_attempts === 0);
  check('Reset cleared lockout_stage', afterReset?.lockout_stage === 0);
  check('Reset cleared locked_until', afterReset?.locked_until === null);

  // 7. The NEW PIN logs in through the real login endpoint.
  const newPinLogin = await login(CUSTOMER.email, CUSTOMER.newPin);
  check('Login with the NEW PIN succeeds', newPinLogin.status === 200,
    `expected 200, got ${newPinLogin.status}: ${JSON.stringify(newPinLogin.data)}`);

  // 8. The OLD PIN no longer works.
  const oldPinLogin = await login(CUSTOMER.email, CUSTOMER.oldPin);
  check('Login with the OLD PIN is rejected', oldPinLogin.status === 401,
    `expected 401, got ${oldPinLogin.status}`);

  // 9. A non-admin (participant JWT) is forbidden from resetting PINs.
  const nonAdminReset = await http('POST', `/admin/users/${CUSTOMER.id}/reset-pin`, {
    token: CUSTOMER.accessToken,
    body: { new_pin: padPin(CUSTOMER.newPin) },
  });
  check('Non-admin reset-pin is forbidden (403)', nonAdminReset.status === 403,
    `expected 403, got ${nonAdminReset.status}`);

  // 10. Unauthenticated callers get 401.
  const anonReset = await http('POST', `/admin/users/${CUSTOMER.id}/reset-pin`, {
    body: { new_pin: padPin(CUSTOMER.newPin) },
  });
  check('Unauthenticated reset-pin is rejected (401)', anonReset.status === 401,
    `expected 401, got ${anonReset.status}`);

  // 11. Resetting a non-existent user returns 404.
  const missingReset = await http('POST', '/admin/users/00000000-0000-4000-8000-000000000000/reset-pin', {
    token: adminToken,
    body: { new_pin: padPin(CUSTOMER.newPin) },
  });
  check('Reset of a non-existent user returns 404', missingReset.status === 404,
    `expected 404, got ${missingReset.status}`);

  // 12. Cleanup + verify.
  await cleanup();
}

main()
  .then(() => {
    console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
    if (failed > 0) {
      console.log('Failed checks:\n  - ' + failures.join('\n  - '));
    }
    return pool.end().then(() => process.exit(failed > 0 ? 1 : 0));
  })
  .catch(async (err) => {
    console.error(`\n==== ERROR: ${err.message} ====`);
    try {
      await cleanup();
    } catch {
      // ignore cleanup errors — original error is what matters
    }
    await pool.end();
    process.exit(1);
  });
