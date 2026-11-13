import { sql } from 'drizzle-orm';
import { db, type Database, type Tx } from '../index';

export type TenantRunner = <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>;

export async function withTenantTx<T>(
  tenantId: string,
  fn: (tx: Tx) => Promise<T>,
  database: Database = db,
): Promise<T> {
  if (!tenantId) throw new Error('withTenantTx requires a non-empty tenantId');
  return database.transaction(async (tx) => {
    // is_local = true scopes the setting to this transaction, so a pooled connection never carries it over.
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}
