import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestTenant, resetDb } from '../../../test/db';
import { testAppDatabaseUrl, testPlatformDatabaseUrl } from '../../../test/roles';

const RLS_VIOLATION = /new row violates row-level security policy/;

let app: postgres.Sql;
let platform: postgres.Sql;
let tenantA: string;
let tenantB: string;

beforeAll(() => {
  app = postgres(testAppDatabaseUrl(), { max: 1, onnotice: () => {} });
  platform = postgres(testPlatformDatabaseUrl(), { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await app?.end();
  await platform?.end();
  await resetDb();
});

beforeEach(async () => {
  await resetDb();
  tenantA = (await createTestTenant('profile-a', undefined, { features: [] })).id;
  tenantB = (await createTestTenant('profile-b', undefined, { features: [] })).id;
  await platform`INSERT INTO tenant_profile (tenant_id, catalog_kind) VALUES (${tenantA}, 'products')`;
  await platform`INSERT INTO tenant_profile (tenant_id, catalog_kind) VALUES (${tenantB}, 'services')`;
});

const asApp = <T>(tenantId: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
  app.begin(async (tx) => {
    if (tenantId) await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  }) as Promise<T>;

const kindOf = async (tenantId: string) =>
  (
    await platform<{ catalog_kind: string }[]>`
      SELECT catalog_kind FROM tenant_profile WHERE tenant_id = ${tenantId}`
  ).map((r) => r.catalog_kind);

describe('tenant_profile row level security', () => {
  it('lets the app role read only the row of its tenant', async () => {
    const seen = await asApp(
      tenantA,
      (tx) => tx`SELECT tenant_id, catalog_kind FROM tenant_profile`,
    );
    expect(seen).toEqual([{ tenant_id: tenantA, catalog_kind: 'products' }]);
  });

  it('shows the app role no row without a tenant', async () => {
    expect(await asApp(null, (tx) => tx`SELECT 1 FROM tenant_profile`)).toHaveLength(0);
  });

  it('does not show the row of another organization', async () => {
    const seen = await asApp(
      tenantA,
      (tx) => tx`SELECT 1 FROM tenant_profile WHERE tenant_id = ${tenantB}`,
    );
    expect(seen).toHaveLength(0);
  });

  it('rejects an insert by the app role even for its own tenant', async () => {
    await platform`DELETE FROM tenant_profile WHERE tenant_id = ${tenantA}`;
    await expect(
      asApp(
        tenantA,
        (tx) =>
          tx`INSERT INTO tenant_profile (tenant_id, catalog_kind) VALUES (${tenantA}, 'services')`,
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  // Without an UPDATE/DELETE policy Postgres filters every row out of the statement instead of
  // raising, so the barrier shows as zero affected rows and unchanged data.
  it('lets the app role neither update nor delete its own row', async () => {
    const affected = await asApp(tenantA, async (tx) => {
      const updated = await tx`
        UPDATE tenant_profile SET catalog_kind = 'services' WHERE tenant_id = ${tenantA}`;
      const deleted = await tx`DELETE FROM tenant_profile WHERE tenant_id = ${tenantA}`;
      return [updated.count, deleted.count];
    });
    expect(affected).toEqual([0, 0]);
    expect(await kindOf(tenantA)).toEqual(['products']);
  });

  it('lets the platform role read and write the row of every tenant', async () => {
    const seen = await platform<{ tenant_id: string }[]>`
      SELECT tenant_id FROM tenant_profile ORDER BY tenant_id`;
    expect(seen.map((r) => r.tenant_id)).toEqual([tenantA, tenantB].sort());

    await platform`UPDATE tenant_profile SET catalog_kind = 'services' WHERE tenant_id = ${tenantA}`;
    expect(await kindOf(tenantA)).toEqual(['services']);
    await platform`DELETE FROM tenant_profile WHERE tenant_id = ${tenantB}`;
    expect(await kindOf(tenantB)).toEqual([]);
  });
});
