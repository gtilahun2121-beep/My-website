/**
 * postgres-data-source.provider.ts
 *
 * A minimal `DataSource` (TypeORM) —compatible provider backed by the app's
 * postgres.js pool (`getPool()`).
 *
 * QalNet deliberately uses postgres.js for all database access and never
 * wires up a TypeORM connection. A handful of services still inject the
 * TypeORM `DataSource` class for their raw-SQL work; this provider serves
 * those two methods — `query()` and `transaction()` — so the services keep
 * working without spinning up a second database connection.
 */

import { DataSource } from 'typeorm';
import { getPool } from '../../config/database.config';

/** Transaction handle handed to `.transaction(run)` callbacks. */
export interface TransactionProxy {
    query: (text: string, params?: unknown[]) => Promise<any[]>;
}

export const POSTGRES_DATA_SOURCE_PROVIDER = {
    provide: DataSource,
    useFactory: (): Pick<DataSource, 'query' | 'transaction'> => {
        const sql = getPool();

        return {
            async query(text: string, params: unknown[] = []): Promise<any[]> {
                return sql.unsafe(text, params as never[]);
            },

            async transaction<T>(
                run: (tx: TransactionProxy) => Promise<T>,
            ): Promise<T> {
                return (sql.begin(async (tx) =>
                    run({
                        query: (
                            text: string,
                            params: unknown[] = [],
                        ): Promise<any[]> => tx.unsafe(text, params as never[]),
                    }),
                ) as unknown) as Promise<T>;
            },
        } as unknown as Pick<DataSource, 'query' | 'transaction'>;
    },
};