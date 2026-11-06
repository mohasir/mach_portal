import { beforeEach, describe, expect, it } from 'vitest';
import { addMember, createTestTenant, createTestUser, resetDb } from '../../../test/db';
import { evaluateTenantAccess } from '../access';

describe('evaluateTenantAccess', () => {
  beforeEach(resetDb);

  it('allows a member without platform access', async () => {
    const t = await createTestTenant('acme');
    const u = await createTestUser();
    await addMember(u.id, t.id);
    await expect(
      evaluateTenantAccess({ userId: u.id, isPlatformAdmin: false, tenantId: t.id }),
    ).resolves.toEqual({ allowed: true, platformAccess: false });
  });

  it('denies a non-member', async () => {
    const t = await createTestTenant('acme');
    const u = await createTestUser();
    await expect(
      evaluateTenantAccess({ userId: u.id, isPlatformAdmin: false, tenantId: t.id }),
    ).resolves.toEqual({ allowed: false });
  });

  it('treats a nullish platform flag as not a platform admin', async () => {
    const t = await createTestTenant('acme');
    const u = await createTestUser();
    await expect(
      evaluateTenantAccess({ userId: u.id, isPlatformAdmin: null, tenantId: t.id }),
    ).resolves.toEqual({ allowed: false });
  });

  it('allows a platform admin without membership as platform access', async () => {
    const t = await createTestTenant('acme');
    const u = await createTestUser({ isPlatformAdmin: true });
    await expect(
      evaluateTenantAccess({ userId: u.id, isPlatformAdmin: true, tenantId: t.id }),
    ).resolves.toEqual({ allowed: true, platformAccess: true });
  });

  it('keeps a platform admin who is also a member as a plain member', async () => {
    const t = await createTestTenant('acme');
    const u = await createTestUser({ isPlatformAdmin: true });
    await addMember(u.id, t.id);
    await expect(
      evaluateTenantAccess({ userId: u.id, isPlatformAdmin: true, tenantId: t.id }),
    ).resolves.toEqual({ allowed: true, platformAccess: false });
  });
});
