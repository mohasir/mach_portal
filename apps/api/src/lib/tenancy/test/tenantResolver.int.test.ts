import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { organization } from '../../../db/schema';
import { createTestTenant, resetDb, testDb } from '../../../test/db';
import { invalidateTenantCache, resolveTenantById } from '../tenantResolver';

describe('resolveTenantById', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns the organization for an existing id', async () => {
    const t = await createTestTenant('acme', 'Acme Inc');
    await expect(resolveTenantById(t.id)).resolves.toEqual({
      id: t.id,
      slug: 'acme',
      name: 'Acme Inc',
    });
  });

  it('returns null for an unknown id', async () => {
    await expect(resolveTenantById('ghost')).resolves.toBeNull();
  });

  it('caches a hit until it is invalidated', async () => {
    const t = await createTestTenant('acme');
    await resolveTenantById(t.id);
    await testDeleteOrg(t.id);
    await expect(resolveTenantById(t.id)).resolves.toMatchObject({ id: t.id });
    invalidateTenantCache(t.id);
    await expect(resolveTenantById(t.id)).resolves.toBeNull();
  });

  it('caches a miss until it is invalidated', async () => {
    await expect(resolveTenantById('late')).resolves.toBeNull();
    await createTestTenantWithId('late', 'late-org');
    await expect(resolveTenantById('late')).resolves.toBeNull();
    invalidateTenantCache('late');
    await expect(resolveTenantById('late')).resolves.toMatchObject({ id: 'late' });
  });
});

async function testDeleteOrg(id: string) {
  await testDb.delete(organization).where(eq(organization.id, id));
}

async function createTestTenantWithId(id: string, slug: string) {
  await testDb.insert(organization).values({ id, name: slug, slug, createdAt: new Date() });
}
