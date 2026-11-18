import postgres from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestTenant, createTestUser, resetDb } from '../../../test/db';
import { testAppDatabaseUrl, testPlatformDatabaseUrl } from '../../../test/roles';

const RLS_VIOLATION = /new row violates row-level security policy/;

let app: postgres.Sql;
let platform: postgres.Sql;
let tenantId: string;
let userId: string;

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
  tenantId = (await createTestTenant('audit-a', undefined, { features: [] })).id;
  userId = (await createTestUser({ isPlatformAdmin: true })).id;
});

const asApp = <T>(tenant: string | null, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
  app.begin(async (tx) => {
    if (tenant) await tx`SELECT set_config('app.tenant_id', ${tenant}, true)`;
    return fn(tx);
  }) as Promise<T>;

describe('platform_audit_log row level security', () => {
  it('app role reads no rows and cannot insert', async () => {
    await platform`
      INSERT INTO platform_audit_log (user_id, action, tenant_id)
      VALUES (${userId}, 'organization.view', ${tenantId})`;

    expect(await asApp(tenantId, (tx) => tx`SELECT 1 FROM platform_audit_log`)).toHaveLength(0);
    await expect(
      asApp(
        tenantId,
        (tx) => tx`
          INSERT INTO platform_audit_log (user_id, action, tenant_id)
          VALUES (${userId}, 'organization.view', ${tenantId})`,
      ),
    ).rejects.toThrow(RLS_VIOLATION);
  });

  it('platform role reads and writes it, with a null tenant_id', async () => {
    await platform`
      INSERT INTO platform_audit_log (user_id, action, tenant_id, payload)
      VALUES (${userId}, 'organization.create', NULL, ${platform.json({ slug: 'acme' })})`;
    await platform`
      INSERT INTO platform_audit_log (user_id, action, tenant_id)
      VALUES (${userId}, 'feature.set', ${tenantId})`;

    const seen = await platform<{ action: string; tenant_id: string | null }[]>`
      SELECT action, tenant_id FROM platform_audit_log ORDER BY action`;
    expect(seen).toEqual([
      { action: 'feature.set', tenant_id: tenantId },
      { action: 'organization.create', tenant_id: null },
    ]);
  });
});
