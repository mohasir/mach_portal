import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestTenant, resetDb, seedTwoTenants, testDb } from './db';

describe('integration harness', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates two isolated tenants with one member each', async () => {
    const { a, b } = await seedTwoTenants();

    const orgs = await testDb.execute<{ id: string }>(sql`SELECT "id" FROM "organization"`);
    expect(orgs).toHaveLength(2);

    const membersA = await testDb.execute(
      sql`SELECT "user_id" FROM "member" WHERE "organization_id" = ${a.id}`,
    );
    const membersB = await testDb.execute(
      sql`SELECT "user_id" FROM "member" WHERE "organization_id" = ${b.id}`,
    );
    expect(membersA).toHaveLength(1);
    expect(membersB).toHaveLength(1);
    expect(membersA[0]?.user_id).toBe(a.userId);
    expect(membersB[0]?.user_id).toBe(b.userId);
  });

  it('slug is unique across organizations', async () => {
    await createTestTenant('dup');
    await expect(createTestTenant('dup')).rejects.toThrow();
  });
});
