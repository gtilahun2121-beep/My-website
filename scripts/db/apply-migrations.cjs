#!/usr/bin/env node
/**
 * apply-migrations.cjs
 *
 * Applies pending SQL migrations from apps/backend/database/migrations to the
 * running PostgreSQL database. Tracks applied files in a `schema_migrations`
 * table so the set is deterministic and re-runnable.
 *
 * Usage (from repo root):
 *   node scripts/db/apply-migrations.cjs                 # apply pending
 *   node scripts/db/apply-migrations.cjs --baseline      # record existing files
 *                                                          as applied WITHOUT
 *                                                          executing them
 *   DATABASE_URL=... node scripts/db/apply-migrations.cjs
 *
 * On an existing database whose migrations were applied outside this tracker
 * (e.g. the docker initdb path or a manual psql run), run the script once with
 * `--baseline` to mark them applied, then use plain runs to pick up new files.
 */

const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const MIGRATIONS_DIR = path.resolve(
    __dirname, '../../apps/backend/database/migrations',
);

const baseline = process.argv.includes('--baseline');

(async () => {
    const url =
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5433/qalnet_dev';
    const sql = postgres(url, {
        max: 1,
        ssl: /localhost|127\.0\.0\.1|::1/i.test(url) ? false : { rejectUnauthorized: false },
    });

    try {
        await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
            filename     VARCHAR(255) PRIMARY KEY,
            applied_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )`;

        const files = fs
            .readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            console.log('No migration files found.');
            return;
        }

        const applied = new Set(
            (await sql`SELECT filename FROM schema_migrations`).map((r) => r.filename),
        );

        if (baseline) {
            let recorded = 0;
            for (const file of files) {
                if (!applied.has(file)) {
                    await sql`
                        INSERT INTO schema_migrations (filename)
                        VALUES (${file})
                        ON CONFLICT (filename) DO NOTHING
                    `;
                    recorded++;
                }
            }
            console.log(
                `Baseline complete — recorded ${recorded} existing migration(s) ` +
                `as applied (none executed). Run again without --baseline to ` +
                `apply any future migrations.`,
            );
            return;
        }

        const pending = files.filter((f) => !applied.has(f));

        if (pending.length === 0) {
            console.log(`Schema migrations up to date (${files.length} tracked).`);
            return;
        }

        console.log(`Applying ${pending.length} pending migration(s)...`);
        for (const file of pending) {
            const body = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            console.log(`  → ${file}`);

            for (const stmt of splitStatements(body)) {
                const clean = stmt.replace(/^\s*(--.*)?\s*$/gm, '').trim();
                if (clean) {
                    await sql.unsafe(clean);
                }
            }
            await sql`
                INSERT INTO schema_migrations (filename)
                VALUES (${file})
                ON CONFLICT (filename) DO NOTHING
            `;
            console.log(`     ✓ applied and recorded`);
        }

        console.log(`\nDone. ${pending.length} migration(s) applied.`);

function splitStatements(sqlText) {
    const statements = [];
    let current = '';
    let inDollar = false;
    let dollarTag = '';
    let inQuote = false;
    let i = 0;

    while (i < sqlText.length) {
        const ch = sqlText[i];
        const rest = sqlText.slice(i);

        if (!inDollar && !inQuote && rest.startsWith('$$')) {
            inDollar = true;
            dollarTag = '$$';
            current += '$$';
            i += 2;
            continue;
        }
        if (inDollar) {
            current += ch;
            if (ch === '$' && sqlText[i - 1] === '$') {
                inDollar = false;
            }
            i++;
            continue;
        }
        if (!inQuote && ch === "'") {
            inQuote = true;
            current += ch;
            i++;
            continue;
        }
        if (inQuote) {
            if (ch === "'") {
                if (sqlText[i + 1] === "'") {
                    current += "''";
                    i += 2;
                    continue;
                }
                inQuote = false;
            }
            current += ch;
            i++;
            continue;
        }
        if (!inQuote && ch === '-' && sqlText[i + 1] === '-') {
            // SQL line comment — skip to EOL so `;` inside a comment can't
            // split the statement queue or leak fragments into the SQL.
            while (i < sqlText.length && sqlText[i] !== '\n') i++;
            current += '\n';
            continue;
        }
        if (ch === ';') {
            statements.push(current);
            current = '';
            i++;
            continue;
        }
        current += ch;
        i++;
    }

    if (current.trim()) statements.push(current);
    return statements;
}
    } finally {
        await sql.end();
    }
})().catch((err) => {
    console.error('Migration apply failed:', err.message);
    process.exit(1);
});