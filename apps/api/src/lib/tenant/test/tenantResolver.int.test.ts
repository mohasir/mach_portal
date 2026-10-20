import { beforeEach, describe, expect, it } from 'vitest';
import { createTestTenant, resetDb } from '../../../test/db';
import { invalidateTenantCache, resolveTenantBySlug } from '../tenantResolver';

describe('resolveTenantBySlug', () => {
  beforeEach(async () => {
    await resetDb();
    invalidateTenantCache();
  });

  it('returns the organization for an existing slug', async () => {
    const t = await createTestTenant('acme', 'Acme Inc');
    await expect(resolveTenantBySlug('acme')).resolves.toEqual({
      id: t.id,
      slug: 'acme',
      name: 'Acme Inc',
    });
  });

  it('returns null for an unknown slug', async () => {
    await expect(resolveTenantBySlug('ghost')).resolves.toBeNull();
  });

  it('sees a tenant created after a cached miss once the cache is invalidated', async () => {
    await expect(resolveTenantBySlug('late')).resolves.toBeNull();
    const t = await createTestTenant('late');
    await expect(resolveTenantBySlug('late')).resolves.toBeNull();
    invalidateTenantCache('late');
    await expect(resolveTenantBySlug('late')).resolves.toMatchObject({ id: t.id });
  });
});
