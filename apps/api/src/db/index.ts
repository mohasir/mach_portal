import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../env';

export const queryClient = postgres(env.DATABASE_APP_URL, { max: env.DB_POOL_MAX });
export const db = drizzle(queryClient, { schema });
// Better Auth runs inside requests that already hold a request-transaction connection from
// `queryClient`; its own pool keeps it from waiting on (and exhausting) that one.
export const authQueryClient = postgres(env.DATABASE_APP_URL, { max: env.DB_AUTH_POOL_MAX });
export const authDb = drizzle(authQueryClient, { schema });
export type Database = typeof db;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
// Either the pool or an open transaction, for helpers that must also run inside a caller's tx.
export type Executor = Database | Tx;
export { withTenantTx, type TenantRunner } from './rls/tenantTx';
