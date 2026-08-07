/**
 * database.config.ts
 *
 * Configures the Neon serverless Postgres connection pool.
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

import postgres, { Sql, TransactionSql } from 'postgres';
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
// Module-level singleton
// ---------------------------------------------------------------------------

let _sql: Sql | null = null;

/**
 * Returns the initialised postgres.js connection pool.
 * Lazily created on first call and reused for the lifetime of the process.
 *
 * Must be called AFTER VaultConfig.load() has been awaited in main.ts.
 */
export function getPool(): Sql {
    if (_sql) return _sql;

    const url = process.env._DB_URL_CACHE; // set by initDatabase()
    if (!url) {
        throw new Error(
            '[DatabaseConfig] getPool() called before initDatabase(). ' +
            'Call initDatabase() once at application bootstrap.',
        );
    }

    _sql = postgres(url, {
        // Neon recommends a modest pool size for serverless workloads
        max: 10,
        idle_timeout: 20,   // seconds before an idle connection is closed
        connect_timeout: 60, // raised from 10s — Neon pooler can take up to ~30s on cold start

        // SSL — defer to the connection string flags (sslmode + channel_binding)
        // Setting ssl:'require' here conflicts with channel_binding=require on the pooler
        ssl: { rejectUnauthorized: false },

        // Automatically parse numeric columns as JS numbers
        // (Postgres returns NUMERIC as strings by default)
        types: {
            numeric: {
                to: 0,
                from: [1700],
                serialize: (x: number) => String(x),
                parse: (x: string) => parseFloat(x),
            },
        },

        // Log slow queries in development for performance visibility
        onnotice: process.env.NODE_ENV !== 'production'
            ? (notice) => console.debug('[PG Notice]', notice.message)
            : undefined,
    });

    return _sql;
}

/**
 * Bootstrap function called once in main.ts.
 * Resolves the DATABASE_URL from VaultConfig and warms the pool.
 */
export async function initDatabase(): Promise<void> {
    const secrets: QalNetSecrets = await VaultConfig.load();

    // Cache the URL in process.env so getPool() can access it synchronously
    process.env._DB_URL_CACHE = secrets.DATABASE_URL;

    // Warm the pool with a lightweight probe
    const sql = getPool();
    await sql`SELECT 1`;

    console.log('[DatabaseConfig] Neon connection pool initialised.');
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
 *
 * Example:
 *   const rows = await withRlsContext(
 *     { userId: jwt.sub, userRole: jwt.role },
 *     (sql) => sql`SELECT * FROM payments WHERE user_id = ${jwt.sub}`
 *   );
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
