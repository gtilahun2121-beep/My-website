const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.resolve(__dirname, '.env');
const env = fs.readFileSync(envPath, 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.log('no DATABASE_URL'); process.exit(1); }
const url = m[1].trim().replace(/^"|"$/g, '');
const sql = postgres(url, { ssl: { rejectUnauthorized: false } });

const migrationsDir = path.resolve(__dirname, 'database/migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

function splitStatements(content) {
  const stmts = [];
  let current = '';
  let inString = null;
  let i = 0;
  while (i < content.length) {
    const c = content[i];
    if (inString) {
      current += c;
      if (c === inString) inString = null;
      if (c === '\\' && inString === "'") { if (i + 1 < content.length) { current += content[i + 1]; i++; } }
      i++;
      continue;
    }
    if (c === "'" || c === '"') { inString = c; current += c; i++; continue; }
    if (c === '-' && content[i + 1] === '-') {
      while (i < content.length && content[i] !== '\n') i++;
      current += '\n';
      continue;
    }
    if (c === ';') { stmts.push(current + ';'); current = ''; i++; continue; }
    current += c;
    i++;
  }
  if (current.trim()) stmts.push(current + ';');
  return stmts.filter((s) => s.trim());
}

(async () => {
  for (const f of files) {
    console.log(`\n=== ${f} ===`);
    const content = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
    const stmts = splitStatements(content);
    for (const stmt of stmts) {
      try {
        await sql.unsafe(stmt);
        console.log('  OK:', stmt.slice(0, 70).replace(/\s+/g, ' ').trim());
      } catch (e) {
        console.log('  FAIL:', e.message);
        console.log('    SQL:', stmt.slice(0, 120).replace(/\s+/g, ' ').trim());
      }
    }
  }
  console.log('\nDONE');
  await sql.end();
  process.exit(0);
})().catch(async (e) => { console.log('FATAL:', e.message); try { await sql.end(); } catch {} process.exit(1); });