import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedEventsTenant, seedQuoteStages } from '../../../test/fixtures/events';
import { createTestTenant, resetDb, seedTwoTenants, testDb } from '../../../test/db';
import { testAppDatabaseUrl, testPlatformDatabaseUrl } from '../../../test/roles';
import type { Database } from '../../index';
import { TENANT_TABLES } from '../../scripts/verifyMultitenant';
import { withTenantTx } from '../tenantTx';
import {
  clients,
  events,
  notifications,
  platformAccessLog,
  quotes,
  role,
  rolePermission,
} from '../../schema';

const RLS_TABLES = [...TENANT_TABLES, 'platform_access_log'];
const RLS_VIOLATION = /new row violates row-level security policy/;

const q = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

let admin: postgres.Sql;
let app: postgres.Sql;
let platform: postgres.Sql;

beforeAll(() => {
  admin = postgres(process.env['TEST_DATABASE_URL']!, { max: 1, onnotice: () => {} });
  // One connection each, so a setting leaked by an earlier transaction would be observed.
  app = postgres(testAppDatabaseUrl(), { max: 1, onnotice: () => {} });
  platform = postgres(testPlatformDatabaseUrl(), { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await app?.end();
  await platform?.end();
  await admin?.end();
  await resetDb();
});

type Column = { name: string; udt: string; type: string };

// A value for every NOT NULL column without a default, so a row can be built for any table
// without knowing its business rules (foreign keys are skipped while seeding, see seedRow).
function placeholder({ udt, type }: Column): string {
  if (type === 'USER-DEFINED') return `(enum_range(NULL::${q(udt)}))[1]`;
  switch (udt) {
    case 'text':
    case 'varchar':
      return `'rls-' || gen_random_uuid()`;
    case 'uuid':
      return 'gen_random_uuid()';
    case 'int2':
    case 'int4':
    case 'int8':
    case 'numeric':
      return '1';
    case 'bool':
      return 'false';
    case 'date':
      return 'current_date';
    case 'timestamp':
    case 'timestamptz':
      return 'now()';
    case 'json':
    case 'jsonb':
      return `'{}'`;
    default:
      throw new Error(`No placeholder for column type ${udt}`);
  }
}

async function requiredColumns(table: string): Promise<Column[]> {
  return admin<Column[]>`
    SELECT column_name AS name, udt_name AS udt, data_type AS type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
      AND is_nullable = 'NO' AND column_default IS NULL
      AND is_identity = 'NO' AND is_generated = 'NEVER'
      AND column_name <> 'tenant_id'`;
}

function insertStatement(table: string, columns: Column[], tenantId: string) {
  const names = ['tenant_id', ...columns.map((c) => c.name)].map(q).join(', ');
  const values = [`'${tenantId}'`, ...columns.map(placeholder)].join(', ');
  return `INSERT INTO ${q(table)} (${names}) VALUES (${values})`;
}

describe('row level security on every tenant table', () => {
  let tenantA: string;
  let tenantB: string;
  const columnsOf = new Map<string, Column[]>();

  beforeAll(async () => {
    await resetDb();
    // One row per table and tenant: the default system units would add more.
    tenantA = (await createTestTenant('rls-a', 'rls-a', { units: false })).id;
    tenantB = (await createTestTenant('rls-b', 'rls-b', { units: false })).id;
    for (const table of RLS_TABLES) columnsOf.set(table, await requiredColumns(table));
    // Replica mode disables the foreign key triggers, so each table gets one row per tenant without
    // building its parent chain. Only the superuser seeding connection can do this.
    await admin.begin(async (tx) => {
      await tx.unsafe('SET LOCAL session_replication_role = replica');
      for (const table of RLS_TABLES) {
        for (const tenant of [tenantA, tenantB]) {
          await tx.unsafe(insertStatement(table, columnsOf.get(table)!, tenant));
        }
      }
    });
  });

  const asApp = <T>(tenantId: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
    app.begin(async (tx) => {
      if (tenantId) await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    }) as Promise<T>;

  const tenantsSeen = async (sql: postgres.Sql | postgres.TransactionSql, table: string) => {
    const rows = await sql.unsafe<{ tenant_id: string }[]>(
      `SELECT tenant_id FROM ${q(table)} ORDER BY tenant_id`,
    );
    return rows.map((r) => r.tenant_id);
  };

  it.each(RLS_TABLES)('%s: an unfiltered select returns only the current tenant', async (table) => {
    expect(await asApp(tenantA, (tx) => tenantsSeen(tx, table))).toEqual([tenantA]);
    expect(await asApp(tenantB, (tx) => tenantsSeen(tx, table))).toEqual([tenantB]);
  });

  it.each(RLS_TABLES)('%s: without a tenant no row is visible', async (table) => {
    expect(await asApp(null, (tx) => tenantsSeen(tx, table))).toEqual([]);
    // Once a transaction-local setting ended, the (single) connection reads '' instead of NULL.
    await asApp(tenantA, (tx) => tenantsSeen(tx, table));
    const [setting] = await app<{ value: string | null }[]>`
      SELECT current_setting('app.tenant_id', true) AS value`;
    expect(setting?.value).toBe('');
    expect(await tenantsSeen(app, table)).toEqual([]);
  });

  it.each(RLS_TABLES)('%s: inserting a row of another tenant is rejected', async (table) => {
    const insert = insertStatement(table, columnsOf.get(table)!, tenantB);
    await expect(asApp(tenantA, (tx) => tx.unsafe(insert))).rejects.toThrow(RLS_VIOLATION);
    await expect(asApp(null, (tx) => tx.unsafe(insert))).rejects.toThrow(RLS_VIOLATION);
  });

  it.each(RLS_TABLES)('%s: a row cannot be moved to another tenant', async (table) => {
    await expect(
      asApp(tenantA, (tx) =>
        tx.unsafe(`UPDATE ${q(table)} SET tenant_id = $1 WHERE tenant_id = $2`, [tenantB, tenantA]),
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  it.each(RLS_TABLES)('%s: rows of another tenant cannot be updated or deleted', async (table) => {
    const affected = await asApp(tenantA, async (tx) => {
      const updated = await tx.unsafe(
        `UPDATE ${q(table)} SET tenant_id = tenant_id WHERE tenant_id = $1`,
        [tenantB],
      );
      const deleted = await tx.unsafe(`DELETE FROM ${q(table)} WHERE tenant_id = $1`, [tenantB]);
      return [updated.count, deleted.count];
    });
    expect(affected).toEqual([0, 0]);
    const [row] = await admin.unsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM ${q(table)} WHERE tenant_id = $1`,
      [tenantB],
    );
    expect(row!.n).toBe(1);
  });

  it.each(RLS_TABLES)('%s: the platform role sees every tenant', async (table) => {
    expect(await tenantsSeen(platform, table)).toEqual([tenantA, tenantB].sort());
  });
});

describe('row level security with business fixtures', () => {
  let appDb: Database;
  let platformDb: Database;
  let a: string;
  let b: string;

  beforeAll(async () => {
    await resetDb();
    appDb = drizzle(app) as unknown as Database;
    platformDb = drizzle(platform) as unknown as Database;
    const tenants = await seedTwoTenants();
    a = tenants.a.id;
    b = tenants.b.id;
    await seedQuoteStages();
    await seedEventsTenant(tenants.a, 'A');
    await seedEventsTenant(tenants.b, 'B');
    await testDb.insert(platformAccessLog).values([
      { userId: tenants.a.userId, tenantId: a, path: 'clients.list', type: 'query' },
      { userId: tenants.b.userId, tenantId: b, path: 'clients.list', type: 'query' },
    ]);
  });

  const tables = [
    ['clients', clients],
    ['quotes', quotes],
    ['events', events],
    ['role', role],
    ['role_permission', rolePermission],
    ['notifications', notifications],
    ['platform_access_log', platformAccessLog],
  ] as const;

  it.each(tables)('%s: the app role reads exactly the rows of its tenant', async (_name, table) => {
    const expected = await testDb
      .select({ tenantId: table.tenantId })
      .from(table)
      .where(eq(table.tenantId, a));
    expect(expected.length).toBeGreaterThan(0);
    const seen = await withTenantTx(
      a,
      (tx) => tx.select({ tenantId: table.tenantId }).from(table),
      appDb,
    );
    expect(seen).toHaveLength(expected.length);
    expect(new Set(seen.map((r) => r.tenantId))).toEqual(new Set([a]));
  });

  it.each(tables)('%s: the platform role reads both tenants', async (_name, table) => {
    const seen = await platformDb
      .selectDistinct({ tenantId: table.tenantId })
      .from(table)
      .where(inArray(table.tenantId, [a, b]));
    expect(new Set(seen.map((r) => r.tenantId))).toEqual(new Set([a, b]));
  });

  it('the app role writes rows of its own tenant only', async () => {
    const [created] = await withTenantTx(
      a,
      (tx) => tx.insert(clients).values({ tenantId: a, name: 'Own' }).returning(),
      appDb,
    );
    expect(created!.tenantId).toBe(a);

    await expect(
      withTenantTx(a, (tx) => tx.insert(clients).values({ tenantId: b, name: 'Foreign' }), appDb),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(RLS_VIOLATION) } });
  });

  it('the app role cannot touch the rows of another tenant', async () => {
    const [updated, deleted] = await withTenantTx(
      a,
      async (tx) => [
        await tx
          .update(clients)
          .set({ name: 'Hijacked' })
          .where(eq(clients.tenantId, b))
          .returning(),
        await tx.delete(notifications).where(eq(notifications.tenantId, b)).returning(),
      ],
      appDb,
    );
    expect(updated).toEqual([]);
    expect(deleted).toEqual([]);
    const foreign = await testDb.select().from(clients).where(eq(clients.tenantId, b));
    expect(foreign.map((c) => c.name)).not.toContain('Hijacked');
  });

  it('keeps an id from another tenant out of reach even when named explicitly', async () => {
    const [foreignClient] = await testDb
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.tenantId, b));
    const seen = await withTenantTx(
      a,
      (tx) => tx.select().from(clients).where(eq(clients.id, foreignClient!.id)),
      appDb,
    );
    expect(seen).toEqual([]);
  });
});
