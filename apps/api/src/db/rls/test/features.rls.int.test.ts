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
  tenantA = (await createTestTenant('features-a', undefined, { features: [] })).id;
  tenantB = (await createTestTenant('features-b', undefined, { features: [] })).id;
  for (const tenant of [tenantA, tenantB]) {
    await platform`
      INSERT INTO tenant_features (tenant_id, feature_key) VALUES (${tenant}, 'quotes')`;
    await platform`
      INSERT INTO tenant_feature_events (tenant_id, feature_key, action, actor)
      VALUES (${tenant}, 'quotes', 'enabled', 'seed')`;
  }
});

const asApp = <T>(tenantId: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
  app.begin(async (tx) => {
    if (tenantId) await tx`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  }) as Promise<T>;

const featureRows = (sql: postgres.Sql, tenantId: string) =>
  sql<{ feature_key: string; enabled: boolean }[]>`
    SELECT feature_key, enabled FROM tenant_features WHERE tenant_id = ${tenantId}
    ORDER BY feature_key`;

describe('tenant_features row level security', () => {
  it('lets the app role read only the rows of its tenant', async () => {
    const seen = await asApp(
      tenantA,
      (tx) => tx`SELECT tenant_id, feature_key FROM tenant_features`,
    );
    expect(seen).toEqual([{ tenant_id: tenantA, feature_key: 'quotes' }]);
  });

  it('shows the app role no row without a tenant', async () => {
    expect(await asApp(null, (tx) => tx`SELECT 1 FROM tenant_features`)).toHaveLength(0);
  });

  it('rejects an insert by the app role even for its own tenant', async () => {
    await expect(
      asApp(
        tenantA,
        (tx) =>
          tx`INSERT INTO tenant_features (tenant_id, feature_key) VALUES (${tenantA}, 'events')`,
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  // Without an UPDATE/DELETE policy Postgres filters every row out of the statement instead of
  // raising, so the barrier shows as zero affected rows and unchanged data.
  it('lets the app role neither update nor delete the rows of its own tenant', async () => {
    const affected = await asApp(tenantA, async (tx) => {
      const updated = await tx`
        UPDATE tenant_features SET enabled = false WHERE tenant_id = ${tenantA}`;
      const deleted = await tx`DELETE FROM tenant_features WHERE tenant_id = ${tenantA}`;
      return [updated.count, deleted.count];
    });
    expect(affected).toEqual([0, 0]);
    expect(await featureRows(platform, tenantA)).toEqual([
      { feature_key: 'quotes', enabled: true },
    ]);
  });

  it('lets the platform role read and write the rows of every tenant', async () => {
    const seen = await platform<{ tenant_id: string }[]>`
      SELECT tenant_id FROM tenant_features ORDER BY tenant_id`;
    expect(seen.map((r) => r.tenant_id)).toEqual([tenantA, tenantB].sort());

    await platform`
      INSERT INTO tenant_features (tenant_id, feature_key, price_cents, billing_period, currency)
      VALUES (${tenantB}, 'events', 1500, 'monthly', 'USD')`;
    await platform`UPDATE tenant_features SET enabled = false WHERE tenant_id = ${tenantB}`;
    expect(await featureRows(platform, tenantB)).toEqual([
      { feature_key: 'events', enabled: false },
      { feature_key: 'quotes', enabled: false },
    ]);
    await platform`DELETE FROM tenant_features WHERE tenant_id = ${tenantB}`;
    expect(await featureRows(platform, tenantB)).toEqual([]);
  });
});

describe('tenant_feature_events row level security', () => {
  it('shows the app role no row, even of its own tenant', async () => {
    expect(await asApp(tenantA, (tx) => tx`SELECT 1 FROM tenant_feature_events`)).toHaveLength(0);
  });

  it('rejects an insert by the app role for its own tenant', async () => {
    await expect(
      asApp(
        tenantA,
        (tx) => tx`
          INSERT INTO tenant_feature_events (tenant_id, feature_key, action, actor)
          VALUES (${tenantA}, 'quotes', 'disabled', 'app')`,
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  it('lets the platform role read and write the events of every tenant', async () => {
    await platform`
      INSERT INTO tenant_feature_events (tenant_id, feature_key, action, before, after, actor)
      VALUES (${tenantB}, 'quotes', 'updated', ${platform.json({ enabled: true })},
              ${platform.json({ enabled: false })}, 'platform-admin')`;
    const seen = await platform<{ tenant_id: string; action: string }[]>`
      SELECT tenant_id, action FROM tenant_feature_events ORDER BY tenant_id, created_at, action`;
    expect(seen).toHaveLength(3);
    expect(new Set(seen.map((r) => r.tenant_id))).toEqual(new Set([tenantA, tenantB]));
  });
});
