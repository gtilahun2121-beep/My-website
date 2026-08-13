'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND = path.join(ROOT, 'apps', 'backend');
const dotenv = require('dotenv');
const argon2 = require('argon2');
const { Pool } = require('pg');
dotenv.config({ path: path.join(BACKEND, '.env') });

const BASE = 'http://localhost:4000/api/v1';
const PEPPER = process.env.ARGON2_PEPPER;
const ARGON2_OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4, hashLength: 32, saltLength: 16 };
const pad = (p) => (p.length >= 8 && /[A-Za-z]/.test(p) ? p : `${p}QN${p}!`);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const rand = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const now = Date.now();

(async () => {
  const phone = `+2519${rand(8)}`;
  const email = `e2e-stats-${now}@qalnet.test`;
  const hash = await argon2.hash(pad('9999') + PEPPER, ARGON2_OPTIONS);
  const { rows } = await pool.query(
    "INSERT INTO users (phone, email, password_hash, first_name, last_name, fayda_id, role, is_active) VALUES ($1,$2,$3,$4,$5,$6,'admin',TRUE) RETURNING id",
    [phone, email, hash, 'E2E', 'Admin', rand(16)],
  );
  const id = rows[0].id;
  try {
    const login = await fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: email, password: pad('9999') }),
    });
    const loginData = await login.json();
    const token = loginData.access_token;
    const statsRes = await fetch(`${BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('status:', statsRes.status);
    const stats = await statsRes.json();
    console.log('kpis:', JSON.stringify(stats.kpis, null, 2));
    console.log('trend points:', stats.trend?.length, 'first:', stats.trend?.[0], 'last:', stats.trend?.at(-1));
    console.log('recent tx:', stats.recent_transactions?.length);
    console.log('top equbs:', stats.top_equbs?.length, JSON.stringify(stats.top_equbs?.[0] ?? null));
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
    await pool.end();
  }
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
