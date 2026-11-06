import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '../env';

export const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
// Either the pool or an open transaction, for helpers that must also run inside a caller's tx.
export type Executor = Database | Tx;
