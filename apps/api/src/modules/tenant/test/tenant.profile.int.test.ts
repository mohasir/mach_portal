import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../db';
import * as schema from '../../../db/schema';
import { tenantProfile } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { testAppDatabaseUrl } from '../../../test/roles';
import { callerFor } from '../../../test/trpcCaller';

describe('tenant.profile', () => {
  let a: TestTenant;
  let b: TestTenant;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants({ features: [] }));
  });

  it('returns the default kind for an organization without a profile row', async () => {
    await expect(callerFor(a, { id: a.userId }).tenant.profile()).resolves.toEqual({
      catalogKind: 'products',
    });
  });

  it('returns only the kind of the active organization', async () => {
    await testDb.insert(tenantProfile).values([
      { tenantId: a.id, catalogKind: 'services' },
      { tenantId: b.id, catalogKind: 'products' },
    ]);
    await expect(callerFor(a, { id: a.userId }).tenant.profile()).resolves.toEqual({
      catalogKind: 'services',
    });
    await expect(callerFor(b, { id: b.userId }).tenant.profile()).resolves.toEqual({
      catalogKind: 'products',
    });
  });

  // The request transaction is what lets the app role see its own row: the policy needs the tenant.
  it('reads the row through the request transaction of the restricted app role', async () => {
    const client = postgres(testAppDatabaseUrl(), { max: 1, onnotice: () => {} });
    try {
      const appDb = drizzle(client, { schema }) as unknown as Database;
      await testDb.insert(tenantProfile).values([
        { tenantId: a.id, catalogKind: 'services' },
        { tenantId: b.id, catalogKind: 'products' },
      ]);
      await expect(callerFor(a, { id: a.userId }, appDb).tenant.profile()).resolves.toEqual({
        catalogKind: 'services',
      });
    } finally {
      await client.end();
    }
  });

  it('rejects a user who is not a member of the active organization', async () => {
    await expect(callerFor(a, { id: b.userId }).tenant.profile()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
