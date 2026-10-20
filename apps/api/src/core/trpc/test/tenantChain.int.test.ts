import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db';
import { platformAccessLog } from '../../../db/schema';
import { addMember, createTestTenant, createTestUser, resetDb } from '../../../test/db';
import { resetPlatformAccessSessions } from '../platformAccess';
import type { Context } from '../context';
import {
  guardedProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  tenantProcedure,
} from '../trpc';
import { ACTIONS, RESOURCES } from '@repo/guards';

const testRouter = router({
  tenantOnly: tenantProcedure.query(({ ctx }) => ctx.tenant.id),
  protectedQuery: protectedProcedure.query(({ ctx }) => ({
    tenantId: ctx.tenantId,
    role: (ctx.user as { role?: string | null }).role,
  })),
  protectedMutation: protectedProcedure.mutation(({ ctx }) => ctx.tenantId),
  guarded: guardedProcedure({ [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] }).query(() => 'ok'),
  open: publicProcedure.query(() => 'open'),
});
const caller = (ctx: Context) => testRouter.createCaller(ctx);

type Tenant = { id: string; slug: string; name: string };
type UserOverrides = { role?: string; mustChangePassword?: boolean; isPlatformAdmin?: boolean };

function ctxFor(
  tenant: Tenant | null,
  user: { id: string } | null,
  opts: { activeOrganizationId?: string | null; sessionId?: string } & UserOverrides = {},
): Context {
  const session = user
    ? {
        session: {
          id: opts.sessionId ?? `sess-${user.id}`,
          userId: user.id,
          activeOrganizationId:
            opts.activeOrganizationId === undefined ? tenant?.id : opts.activeOrganizationId,
        },
        user: {
          id: user.id,
          role: opts.role ?? 'admin',
          mustChangePassword: opts.mustChangePassword ?? false,
          isPlatformAdmin: opts.isPlatformAdmin ?? false,
        },
      }
    : null;
  return { req: {}, res: {}, session, tenant } as unknown as Context;
}

async function setup() {
  const a = { ...(await createTestTenant('tenant-a', 'Tenant A')), name: 'Tenant A' };
  const b = { ...(await createTestTenant('tenant-b', 'Tenant B')), name: 'Tenant B' };
  return { a, b };
}

describe('tenant-aware procedure chain', () => {
  beforeEach(async () => {
    await resetDb();
    resetPlatformAccessSessions();
  });

  it('tenantProcedure: no tenant -> NOT_FOUND with TENANT_NOT_FOUND', async () => {
    const err = await caller(ctxFor(null, null))
      .tenantOnly()
      .catch((e) => e);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.cause?.code).toBe('TENANT_NOT_FOUND');
  });

  it('tenantProcedure: works without a session', async () => {
    const { a } = await setup();
    await expect(caller(ctxFor(a, null)).tenantOnly()).resolves.toBe(a.id);
  });

  it('protected: no tenant -> NOT_FOUND (tenant is checked before session)', async () => {
    await expect(caller(ctxFor(null, null)).protectedQuery()).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('protected: tenant but no session -> UNAUTHORIZED', async () => {
    const { a } = await setup();
    await expect(caller(ctxFor(a, null)).protectedQuery()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('protected: activeOrganizationId different from the tenant -> UNAUTHORIZED', async () => {
    const { a, b } = await setup();
    const u = await createTestUser();
    await addMember(u.id, b.id);
    await expect(
      caller(ctxFor(b, u, { activeOrganizationId: a.id })).protectedQuery(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(
      caller(ctxFor(b, u, { activeOrganizationId: null })).protectedQuery(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it("protected: member of A using B's host (session active in B) -> FORBIDDEN", async () => {
    const { a, b } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id);
    await expect(caller(ctxFor(b, u)).protectedQuery()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('protected: member passes and exposes ctx.tenantId, with no audit rows', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id);
    await expect(caller(ctxFor(a, u)).protectedQuery()).resolves.toMatchObject({ tenantId: a.id });
    await caller(ctxFor(a, u)).protectedMutation();
    expect(await db.select().from(platformAccessLog)).toHaveLength(0);
  });

  it('protected: mustChangePassword still blocks a member', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id);
    const err = await caller(ctxFor(a, u, { mustChangePassword: true }))
      .protectedQuery()
      .catch((e) => e);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.cause?.code).toBe('USER_MUST_CHANGE_PASSWORD');
  });

  it('protected: mustChangePassword is checked after membership (non-member gets plain FORBIDDEN)', async () => {
    const { a, b } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id);
    const err = await caller(ctxFor(b, u, { mustChangePassword: true }))
      .protectedQuery()
      .catch((e) => e);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.cause).toBeUndefined();
  });

  describe('platform admin', () => {
    it('without membership passes as superadmin and logs the first access of the session', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      const ctx = ctxFor(a, p, { isPlatformAdmin: true, role: 'user', sessionId: 's1' });
      await expect(caller(ctx).protectedQuery()).resolves.toEqual({
        tenantId: a.id,
        role: 'superadmin',
      });
      const rows = await db.select().from(platformAccessLog);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: p.id,
        tenantId: a.id,
        path: 'protectedQuery',
        type: 'query',
      });
      expect(rows[0]!.createdAt).toBeInstanceOf(Date);
    });

    it('does not log further queries of the same session but logs every mutation', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      const ctx = ctxFor(a, p, { isPlatformAdmin: true, sessionId: 's1' });
      await caller(ctx).protectedQuery();
      await caller(ctx).protectedQuery();
      await caller(ctx).protectedMutation();
      await caller(ctx).protectedMutation();
      const rows = await db.select().from(platformAccessLog);
      expect(rows.map((r) => r.type).sort()).toEqual(['mutation', 'mutation', 'query']);
    });

    it('logs the first access again for a different session', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      await caller(ctxFor(a, p, { isPlatformAdmin: true, sessionId: 's1' })).protectedQuery();
      await caller(ctxFor(a, p, { isPlatformAdmin: true, sessionId: 's2' })).protectedQuery();
      expect(await db.select().from(platformAccessLog)).toHaveLength(2);
    });

    it('logs the first access per tenant within the same session', async () => {
      const { a, b } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      await caller(ctxFor(a, p, { isPlatformAdmin: true, sessionId: 's1' })).protectedQuery();
      await caller(ctxFor(b, p, { isPlatformAdmin: true, sessionId: 's1' })).protectedQuery();
      const rows = await db.select().from(platformAccessLog);
      expect(rows.map((r) => r.tenantId).sort()).toEqual([a.id, b.id].sort());
    });

    describe('audit insert failures', () => {
      afterEach(() => vi.restoreAllMocks());

      const failNextInsert = () => {
        const real = db.insert.bind(db);
        let calls = 0;
        return vi.spyOn(db, 'insert').mockImplementation(((table: never) => {
          calls += 1;
          if (calls === 1) throw new Error('audit insert failed');
          return real(table);
        }) as typeof db.insert);
      };

      it('rejects the request and logs the same session on its next query', async () => {
        const { a } = await setup();
        const p = await createTestUser({ isPlatformAdmin: true });
        const ctx = ctxFor(a, p, { isPlatformAdmin: true, sessionId: 's1' });
        failNextInsert();
        await expect(caller(ctx).protectedQuery()).rejects.toThrow();
        expect(await db.select().from(platformAccessLog)).toHaveLength(0);
        await expect(caller(ctx).protectedQuery()).resolves.toMatchObject({ tenantId: a.id });
        expect(await db.select().from(platformAccessLog)).toHaveLength(1);
      });

      it('never lets a concurrent first query run unlogged when the first insert fails', async () => {
        const { a } = await setup();
        const p = await createTestUser({ isPlatformAdmin: true });
        const ctx = ctxFor(a, p, { isPlatformAdmin: true, sessionId: 's1' });
        failNextInsert();
        const results = await Promise.allSettled([
          caller(ctx).protectedQuery(),
          caller(ctx).protectedQuery(),
        ]);
        const rows = await db.select().from(platformAccessLog);
        const executed = results.filter((r) => r.status === 'fulfilled').length;
        expect(executed).toBeLessThanOrEqual(rows.length);
        expect(results.some((r) => r.status === 'rejected')).toBe(true);
        await expect(caller(ctx).protectedQuery()).resolves.toBeDefined();
        expect(await db.select().from(platformAccessLog)).toHaveLength(Math.max(rows.length, 1));
      });
    });

    it('that is also a member keeps its own role and writes no rows', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      await addMember(p.id, a.id);
      const ctx = ctxFor(a, p, { isPlatformAdmin: true, role: 'operator' });
      await expect(caller(ctx).protectedQuery()).resolves.toMatchObject({ role: 'operator' });
      await caller(ctx).protectedMutation();
      expect(
        await db.select().from(platformAccessLog).where(eq(platformAccessLog.userId, p.id)),
      ).toHaveLength(0);
    });

    it('still needs activeOrganizationId to match the tenant', async () => {
      const { a, b } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      await expect(
        caller(
          ctxFor(a, p, { isPlatformAdmin: true, activeOrganizationId: b.id }),
        ).protectedQuery(),
      ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('mustChangePassword still blocks and writes no row', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      await expect(
        caller(ctxFor(a, p, { isPlatformAdmin: true, mustChangePassword: true })).protectedQuery(),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(await db.select().from(platformAccessLog)).toHaveLength(0);
    });

    it('guardedProcedure evaluates permissions with the superadmin role', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      await expect(
        caller(ctxFor(a, p, { isPlatformAdmin: true, role: 'user' })).guarded(),
      ).resolves.toBe('ok');
    });
  });

  it('guardedProcedure still denies a member whose role lacks the permission', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id);
    await expect(caller(ctxFor(a, u, { role: 'member' })).guarded()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('publicProcedure is unaffected by the tenant chain', async () => {
    await expect(caller(ctxFor(null, null)).open()).resolves.toBe('open');
  });
});
