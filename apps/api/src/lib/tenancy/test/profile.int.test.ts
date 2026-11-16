import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG_KIND } from '@repo/schemas';
import { tenantProfile } from '../../../db/schema';
import { createTestTenant, resetDb, testDb } from '../../../test/db';
import { ErrorCodes } from '../../errors';
import { getCatalogKind, setCatalogKind } from '../profile';

const rows = (tenantId: string) =>
  testDb.select().from(tenantProfile).where(eq(tenantProfile.tenantId, tenantId));

describe('tenant profile', () => {
  let tenant: { id: string; slug: string };

  beforeEach(async () => {
    await resetDb();
    tenant = await createTestTenant('profile-svc', undefined, { features: [] });
  });

  it('reads the default kind when the organization has no row', async () => {
    expect(DEFAULT_CATALOG_KIND).toBe('products');
    expect(await getCatalogKind(testDb, tenant.id)).toBe('products');
  });

  it('creates the row on first set and updates it afterwards', async () => {
    await setCatalogKind(testDb, { tenantSlug: tenant.slug, kind: 'services' });
    expect(await getCatalogKind(testDb, tenant.id)).toBe('services');
    expect(await rows(tenant.id)).toHaveLength(1);

    await setCatalogKind(testDb, { tenantSlug: tenant.slug, kind: 'products' });
    expect(await getCatalogKind(testDb, tenant.id)).toBe('products');
    expect(await rows(tenant.id)).toHaveLength(1);
  });

  it('rejects a kind outside the registry and stores nothing', async () => {
    await expect(
      setCatalogKind(testDb, { tenantSlug: tenant.slug, kind: 'stations' }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      cause: { code: ErrorCodes.tenant.UNKNOWN_CATALOG_KIND },
    });
    expect(await rows(tenant.id)).toHaveLength(0);
  });

  it('rejects an unknown organization', async () => {
    await expect(
      setCatalogKind(testDb, { tenantSlug: 'does-not-exist', kind: 'services' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: ErrorCodes.tenant.NOT_FOUND } });
  });

  it('keeps the kinds of two organizations apart', async () => {
    const other = await createTestTenant('profile-other', undefined, { features: [] });
    await setCatalogKind(testDb, { tenantSlug: tenant.slug, kind: 'services' });
    expect(await getCatalogKind(testDb, other.id)).toBe('products');
  });
});
