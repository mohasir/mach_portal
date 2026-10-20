import { beforeEach, describe, expect, it } from 'vitest';
import { appRouter } from '../../../core/trpc/router';
import type { Context } from '../../../core/trpc/context';
import { addMember, createTestTenant, createTestUser, resetDb } from '../../../test/db';

function ctx(
  tenant: { id: string; slug: string; name: string } | null,
  user?: { id: string; isPlatformAdmin?: boolean },
): Context {
  const session = user
    ? {
        session: { id: `s-${user.id}`, userId: user.id, activeOrganizationId: tenant?.id },
        user: { id: user.id, role: 'admin', isPlatformAdmin: user.isPlatformAdmin ?? false },
      }
    : null;
  return { req: {}, res: {}, session, tenant } as unknown as Context;
}

describe('tenant.current', () => {
  beforeEach(resetDb);

  it('works without a session', async () => {
    const t = { ...(await createTestTenant('acme', 'Acme Inc')), name: 'Acme Inc' };
    await expect(appRouter.createCaller(ctx(t)).tenant.current()).resolves.toEqual({
      id: t.id,
      slug: 'acme',
      name: 'Acme Inc',
      isPlatformAccess: false,
    });
  });

  it('is NOT_FOUND when the host has no tenant', async () => {
    await expect(appRouter.createCaller(ctx(null)).tenant.current()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('is false for a regular member', async () => {
    const t = { ...(await createTestTenant('acme')), name: 'acme' };
    const u = await createTestUser();
    await addMember(u.id, t.id);
    const res = await appRouter.createCaller(ctx(t, u)).tenant.current();
    expect(res.isPlatformAccess).toBe(false);
  });

  it('is true for a platform admin without membership', async () => {
    const t = { ...(await createTestTenant('acme')), name: 'acme' };
    const p = await createTestUser({ isPlatformAdmin: true });
    const res = await appRouter
      .createCaller(ctx(t, { id: p.id, isPlatformAdmin: true }))
      .tenant.current();
    expect(res.isPlatformAccess).toBe(true);
  });

  it('is false for a platform admin who is also a member', async () => {
    const t = { ...(await createTestTenant('acme')), name: 'acme' };
    const p = await createTestUser({ isPlatformAdmin: true });
    await addMember(p.id, t.id);
    const res = await appRouter
      .createCaller(ctx(t, { id: p.id, isPlatformAdmin: true }))
      .tenant.current();
    expect(res.isPlatformAccess).toBe(false);
  });

  it('is false for a non-admin session that is not a member', async () => {
    const t = { ...(await createTestTenant('acme')), name: 'acme' };
    const u = await createTestUser();
    const res = await appRouter.createCaller(ctx(t, u)).tenant.current();
    expect(res.isPlatformAccess).toBe(false);
  });
});
