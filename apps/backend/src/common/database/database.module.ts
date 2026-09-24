/**
 * database.module.ts
 *
 * Global module that wires the postgres.js-backed `DataSource` provider so any
 * service can inject the TypeORM `DataSource` class and use its `query()` /
 * `transaction()` helpers against the app's existing connection pool.
 */

import { Global, Module } from '@nestjs/common';
import { POSTGRES_DATA_SOURCE_PROVIDER } from '../providers/postgres-data-source.provider';

@Global()
@Module({
    providers: [POSTGRES_DATA_SOURCE_PROVIDER],
    exports: [POSTGRES_DATA_SOURCE_PROVIDER],
})
export class DatabaseModule {}