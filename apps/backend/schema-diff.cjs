const { Pool } = require('pg');

async function dump(url) {
  const isLocal = /localhost|127\.0\.0\.1|::1/i.test(url);
  const p = new Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: false } });
  const r = await p.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position`);
  const map = {};
  for (const row of r.rows) {
    (map[row.table_name] = map[row.table_name] || []).push(
      `${row.column_name}:${row.data_type}${row.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}${row.column_default ? '=' + row.column_default : ''}`);
  }
  await p.end();
  return map;
}

async function main() {
  const a = await dump(process.env.LOCAL_URL);
  const b = await dump(process.env.NEON_URL);

  const tablesOnlyInLocal = Object.keys(a).filter(t => !(t in b));
  const shared = Object.keys(a).filter(t => t in b);

  console.log('=== Tables on LOCAL missing on NEON ===');
  for (const t of tablesOnlyInLocal) console.log('  ' + t);

  console.log('=== Table count: local=' + Object.keys(a).length + ' neon=' + Object.keys(b).length);

  for (const t of shared.sort()) {
    const la = a[t], lb = b[t];
    const missingCols = la.filter(c => !lb.includes(c));
    const extraCols = lb.filter(c => !la.includes(c));
    if (missingCols.length || extraCols.length) {
      console.log(`\n### ${t}`);
      if (missingCols.length) { console.log('  MISSING on NEON:'); for (const c of missingCols) console.log('    ' + c); }
      if (extraCols.length) { console.log('  EXTRA on NEON (ignored):'); for (const c of extraCols) console.log('    ' + c); }
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });