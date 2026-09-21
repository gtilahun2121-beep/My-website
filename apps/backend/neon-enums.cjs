const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.NEON_URL, ssl: { rejectUnauthorized: false } });
p.query("select typname from pg_type where typtype = 'e' order by typname", (e, r) => {
  if (e) { console.log('FAIL', e.message); process.exit(1); }
  console.log('Neon enums:', r.rows.map(x => x.typname).join(', '));
  p.end();
});