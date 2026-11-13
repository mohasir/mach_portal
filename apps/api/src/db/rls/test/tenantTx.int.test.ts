import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '../../index';
import { withTenantTx } from '../tenantTx';

const TENANT = '11111111-1111-1111-1111-111111111111';

describe('withTenantTx', () => {
  let client: postgres.Sql;
  let database: Database;

  beforeAll(async () => {
    // A single connection forces every call through the same session, so a leaked setting would show.
    client = postgres(process.env['TEST_DATABASE_URL']!, { max: 1, onnotice: () => {} });
    database = drizzle(client) as unknown as Database;
    await client`CREATE TEMP TABLE tenant_tx_probe (id int PRIMARY KEY)`;
  });
  afterAll(async () => {
    await client.end();
  });

  const currentTenant = async (executor: Pick<Database, 'execute'>) => {
    const rows = await executor.execute(sql`select current_setting('app.tenant_id', true) as v`);
    return (rows as unknown as { v: string | null }[])[0]!.v;
  };

  it('exposes the tenant to the transaction', async () => {
    const seen = await withTenantTx(TENANT, (tx) => currentTenant(tx), database);
    expect(seen).toBe(TENANT);
  });

  it('does not leak the tenant after commit on a reused connection', async () => {
    await withTenantTx(TENANT, async () => undefined, database);
    const after = await currentTenant(database);
    expect(after === null || after === '').toBe(true);
  });

  it('rolls back and rethrows the original error when fn throws', async () => {
    const boom = new Error('boom');
    await expect(
      withTenantTx(
        TENANT,
        async (tx) => {
          await tx.execute(sql`insert into tenant_tx_probe (id) values (1)`);
          throw boom;
        },
        database,
      ),
    ).rejects.toBe(boom);
    const rows = await client`select id from tenant_tx_probe`;
    expect(rows).toHaveLength(0);
  });

  it('rejects an empty tenant id', async () => {
    await expect(withTenantTx('', async () => 1, database)).rejects.toThrow();
  });

  it('passes quotes as a bound parameter', async () => {
    const nasty = `x'); drop table tenant_tx_probe; --"`;
    const seen = await withTenantTx(nasty, (tx) => currentTenant(tx), database);
    expect(seen).toBe(nasty);
    const rows = await client`select id from tenant_tx_probe`;
    expect(rows).toHaveLength(0);
  });
});
