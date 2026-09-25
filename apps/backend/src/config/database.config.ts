/**
 * database.config.ts
 *
 * Configures the Neon Postgres connection pool.
 *
 * Protocol note (IMPORTANT):
 *  This app reaches Neon over **port 443 via Neon's WebSocket driver**
 *  (`@neondatabase/serverless`). Many networks (corporate firewalls, ISPs,
 *  mobile data) block outbound TCP 5432 while leaving 443 open — port 443 has
 *  proven reliable here, direct 5432 has proven intermittently blocked. The
 *  same DATABASE_URL is used; the driver tunnels the same wire protocol over
 *  WebSocket/HTTPS instead of raw TCP. `Pool` exposes a node-postgres–style
 *  API (`query()`), which this module adapts to the postgres.js-style surface
 *  (`sql\`...\``, `sql.begin()`, `sql.unsafe()`) the repositories already use,
 *  so no repository needs to change.
 *
 * Key responsibilities:
 *  1. Opens a pooled connection to Neon using the DATABASE_URL secret.
 *  2. Injects the RLS session variables (app.current_user_id,
 *     app.current_user_role) before every query so Postgres RLS
 *     policies can enforce tenant isolation at the database layer.
 *  3. Exposes a typed query helper used by all repository classes.
 *
 * Architecture note:
 *  The connection string is resolved from VaultConfig (AWS Secrets
 *  Manager in production, .env in development) — never hardcoded here.
 */

import { Pool, PoolClient, types as pgTypes } from '@neondatabase/serverless';
// Type-only import: keeps `Sql`/`TransactionSql` signatures stable for the
// repositories while the runtime is the WebSocket-based adapter below.
import { Sql, TransactionSql } from 'postgres';
import { VaultConfig, QalNetSecrets } from './vault.config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Session context injected into every Postgres connection before a query. */
export interface RlsContext {
    userId: string;
    userRole: 'participant' | 'host' | 'admin';
}

/** A scoped query function — either a top-level pool or an open transaction. */
export type QueryScope = Sql | TransactionSql;

// ---------------------------------------------------------------------------
// Type parsers (preserve postgres.js-like numeric handling)
// ---------------------------------------------------------------------------

// numeric → number (Postgres returns NUMERIC as strings by default)
pgTypes.setTypeParser(1700, (value: string) => parseFloat(value));
// int8 → number (COUNT(...) and aggregate amounts are int8; node-postgres
// returns those as strings, postgres.js returned numbers — keep the numbers).
pgTypes.setTypeParser(20, (value: string) => (value === null ? null : Number(value)));

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _pool: Pool | null = null;
let _sql: Sql | null = null;

export function isDatabaseStartupDegraded(): boolean {
    return process.env.NODE_ENV !== 'production' && process.env._DB_STARTUP_FAILED === 'true';
}

export function isDatabaseAvailable(): boolean {
    return process.env._DB_STARTUP_FAILED !== 'true' && Boolean(process.env._DB_URL_CACHE);
}

function createUnavailablePool(): Sql {
    const unavailable = Object.assign(
        async (_strings: TemplateStringsArray | string, ..._args: unknown[]) => {
            throw new Error(
                '[DatabaseConfig] PostgreSQL is unavailable. Start the database service or configure DATABASE_URL before hitting database-backed routes.',
            );
        },
        {
            begin: async (_callback: (tx: unknown) => Promise<unknown>) => {
                throw new Error(
                    '[DatabaseConfig] PostgreSQL is unavailable. Start the database service or configure DATABASE_URL before hitting database-backed routes.',
                );
            },
            unsafe: async (_text: string, _args: unknown[] = []) => {
                throw new Error(
                    '[DatabaseConfig] PostgreSQL is unavailable. Start the database service or configure DATABASE_URL before hitting database-backed routes.',
                );
            },
            end: async () => undefined,
        },
    ) as unknown as Sql;

    return unavailable;
}

// ---------------------------------------------------------------------------
// postgres.js → node-postgres (WebSocket) adapter
// ---------------------------------------------------------------------------

/** A postgres.js-shaped query handle backed by a node-postgres client. */
export type WsSql = {
    (strings: TemplateStringsArray, ...args: unknown[]): Promise<unknown[]>;
    unsafe: (text: string, args?: unknown[]) => Promise<unknown[]>;
    begin: <T>(callback: (tx: WsSql) => Promise<T>) => Promise<T>;
    end: () => Promise<void>;
};

/**
 * Expands a postgres.js tagged template into `$1, $2…` placeholders.
 *
 * Supports postgres.js query fragments: a value built by another
 * `sql\`...\`` call (a lazily-executed thenable with `__frag: true`) is
 * spliced inline with its own parameters renumbered globally, exactly like
 * postgres.js's nested templates. This lets callers reuse query fragments
 * such as `sql`${window.start}::date`` inside larger statements.
 */
function buildParametricQuery(
    strings: TemplateStringsArray,
    values: unknown[],
): { text: string; values: unknown[] } {
    const context = { count: 0, params: [] as unknown[] };

    const render = (parts: TemplateStringsArray, args: unknown[]): string => {
        let text = parts[0];
        for (let i = 0; i < args.length; i++) {
            const arg = args[i] as unknown;
            if (arg && typeof arg === 'object' && (arg as { __frag?: boolean }).__frag === true) {
                const frag = arg as unknown as { strings: TemplateStringsArray; values: unknown[] };
                text += render(frag.strings, frag.values);
            } else {
                text += `$${context.count + 1}`;
                context.params.push(arg);
                context.count += 1;
            }
            text += parts[i + 1];
        }
        return text;
    };

    return { text: render(strings, values), values: context.params };
}

/**
 * A lazy postgres.js-style query node. Awaiting it runs the query; embedding
 * it inside another tagged template splices its SQL/params inline instead of
 * executing it (mirroring postgres.js fragment semantics).
 */
export interface WsQueryNode {
    __frag: boolean;
    strings: TemplateStringsArray;
    values: unknown[];
    then(
        onfulfilled?: (value: unknown[]) => unknown,
        onrejected?: (reason: any) => unknown,
    ): PromiseLike<unknown[]>;
}

/** Wraps a single client (pool or pooled connection) as a postgres.js handle. */
function makeHandle(client: Pool | PoolClient): WsSql {
    function run(strings: TemplateStringsArray, ...args: unknown[]): WsQueryNode {
        const prepared = () => buildParametricQuery(strings, args);
        return {
            __frag: true,
            strings,
            values: args,
            then(onfulfilled, onrejected) {
                const { text, values } = prepared();
                const promise = client.query(text, values).then((result) => result.rows);
                if (!onfulfilled) return promise;
                return promise.then(onfulfilled, onrejected) as PromiseLike<unknown[]>;
            },
        };
    }
    run.unsafe = (text: string, args: unknown[] = []) =>
        client.query(text, args).then((result) => result.rows);
    run.begin = (async () => {
        throw new Error('begin() is only valid on the top-level pool handle.');
    }) as WsSql['begin'];
    run.end = () => Promise.resolve();
    return run as unknown as WsSql;
}

/**
 * Returns the initialised connection pool (postgres.js-compatible `Sql`).
 * Lazily created on first call and reused for the lifetime of the process.
 *
 * Must be called AFTER VaultConfig.load() has been awaited in main.ts.
 */
export function getPool(): Sql {
    if (_sql) return _sql;

    const url = process.env._DB_URL_CACHE; // set by initDatabase()
    if (!url || process.env._DB_STARTUP_FAILED === 'true') {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[DatabaseConfig] Database is unavailable; returning degraded query adapter.');
            return createUnavailablePool();
        }

        throw new Error(
            '[DatabaseConfig] getPool() called before initDatabase(). ' +
            'Call initDatabase() once at application bootstrap.',
        );
    }

    _pool = new Pool({
        connectionString: url,
        // Neon recommends a modest pool size for serverless workloads
        max: 10,
        // No connect timeout on purpose: with cancellation enabled,
        // @neondatabase/serverless throws an uncaught `null.close` crash when
        // a WebSocket connect is cancelled mid-handshake (flaky network). A
        // pending connect simply waits and succeeds when the link recovers;
        // the bootstrap probe below is race-bounded instead, so a truly dead
        // link still fails fast enough to start in degraded mode.
        connectionTimeoutMillis: 0,
    });

    const poolHandle = makeHandle(_pool);
    poolHandle.begin = async <T>(callback: (tx: WsSql) => Promise<T>): Promise<T> => {
        const pool = _pool as Pool;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(makeHandle(client));
            await client.query('COMMIT');
            return result;
        } catch (err) {
            try {
                await client.query('ROLLBACK');
            } catch {
                // ignore rollback failures — the original error is what matters
            }
            throw err;
        } finally {
            client.release();
        }
    };
    poolHandle.end = () => (_pool?.end().then(() => undefined) ?? Promise.resolve());

    _sql = poolHandle as unknown as Sql;
    return _sql;
}

/**
 * Bootstrap function called once in main.ts.
 * Resolves the DATABASE_URL from VaultConfig and warms the pool.
 *
 * The warm-up probe is retried with backoff so a slow Neon cold start
 * (or a transient network blip) does not crash the process on first attempt.
 */
export async function initDatabase(): Promise<void> {
    const secrets: QalNetSecrets = await VaultConfig.load();

    // Cache the URL in process.env so getPool() can access it synchronously
    process.env._DB_URL_CACHE = secrets.DATABASE_URL;
    process.env._DB_STARTUP_FAILED = 'false';

    // Warm the pool with a lightweight probe — retry up to 6 times with
    // exponential backoff (max 10 s per attempt). This tolerates a transient
    // DNS blip or a Neon cold-start without crashing the process.
    const sql = getPool();
    const maxAttempts = 6;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Bound each probe so a stalled connection attempt can never wedge the
        // whole bootstrap. If the pool connect is cancelled by its own timeout,
        // we simply log the failure, back off, and try again.
        const probe = Promise.race([
            sql`SELECT 1`,
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('warm-up probe timed out')), 30_000),
            ),
        ]);
        try {
            await probe;
            console.log('[DatabaseConfig] Neon connection pool initialised.');
            return;
        } catch (err) {
            lastError = err;
            if (attempt < maxAttempts) {
                const delayMs = Math.min(attempt * 2000, 10_000);
                console.warn(
                    `[DatabaseConfig] Warm-up probe failed (attempt ${attempt}/${maxAttempts}). ` +
                    `Retrying in ${delayMs}ms…`,
                );
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
    }

    const detail =
        lastError instanceof Error ? ` Last error: ${lastError.message}` : '';

    if (process.env.NODE_ENV !== 'production') {
        process.env._DB_STARTUP_FAILED = 'true';
        console.warn(
            '[DatabaseConfig] Running in degraded mode because PostgreSQL is not available right now. ' +
            'Database-backed endpoints will return service-unavailable responses until the database comes back.' + detail,
        );
        return;
    }

    throw new Error(
        '[DatabaseConfig] Unable to connect to Neon after multiple attempts. ' +
        'Check that the Neon endpoints (port 443) are reachable from this network and that ' +
        'DATABASE_URL points to the correct pooled endpoint.' + detail,
    );
}

// ---------------------------------------------------------------------------
// RLS Context Injection
// ---------------------------------------------------------------------------

/**
 * Wraps a database operation with RLS session variable injection.
 *
 * Before running `operation`, it sets:
 *   SET LOCAL app.current_user_id  = '<userId>';
 *   SET LOCAL app.current_user_role = '<userRole>';
 *
 * These are read by the current_user_id() and current_user_role()
 * Postgres functions that power the RLS isolation policies.
 *
 * Use this for every query that touches RLS-protected tables
 * (users, wallets, payments).
 */
export async function withRlsContext<T>(
    context: RlsContext,
    operation: (sql: QueryScope) => Promise<T>,
): Promise<T> {
    const sql = getPool();

    return sql.begin(async (tx) => {
        // SET LOCAL scopes the variable to this transaction only —
        // it is automatically cleared when the transaction ends.
        await tx`SELECT set_config('app.current_user_id',  ${context.userId},   true)`;
        await tx`SELECT set_config('app.current_user_role', ${context.userRole}, true)`;

        return operation(tx);
    }) as Promise<T>;
}

/**
 * Wraps a database operation with Admin-level RLS context.
 * Used for admin-only operations (fee config updates, CRB flagging, etc.)
 */
export async function withAdminContext<T>(
    adminId: string,
    operation: (sql: QueryScope) => Promise<T>,
): Promise<T> {
    return withRlsContext({ userId: adminId, userRole: 'admin' }, operation);
}

/**
 * Raw transaction helper for the payment double-prevention pipeline.
 * Gives the caller a TransactionSql so they can issue
 * SELECT ... FOR UPDATE and commit/rollback explicitly.
 *
 * Example:
 *   await inTransaction(context, async (tx) => {
 *     const [payment] = await tx`
 *       SELECT * FROM payments WHERE id = ${id} FOR UPDATE
 *     `;
 *     // ... validate and update
 *   });
 */
export async function inTransaction<T>(
    context: RlsContext,
    operation: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
    const sql = getPool();

    return sql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_user_id',  ${context.userId},   true)`;
        await tx`SELECT set_config('app.current_user_role', ${context.userRole}, true)`;

        return operation(tx);
    }) as Promise<T>;
}

/**
 * Gracefully closes the connection pool.
 * Called in application shutdown hooks.
 */
export async function closeDatabase(): Promise<void> {
    if (_sql) {
        await _sql.end();
        _sql = null;
        console.log('[DatabaseConfig] Neon connection pool closed.');
    }
}