import { and, eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db';
import { member, platformAccessLog, role } from '../../../db/schema';
import {
  addMember,
  createTestTenant,
  createTestUser,
  pointMemberAtForeignRole,
  resetDb,
} from '../../../test/db';
import type { Context } from '../context';
import { HEADERS } from '../../express/const/headers';
import {
  authedProcedure,
  guardedProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  tenantProcedure,
} from '../trpc';
import { ACTIONS, RESOURCES } from '@repo/guards';

const testRouter = router({
  authedOnly: authedProcedure.query(({ ctx }) => ctx.session.user.id),
  tenantOnly: tenantProcedure.query(({ ctx }) => ctx.tenant.id),
  protectedQuery: protectedProcedure.query(({ ctx }) => ({
    tenantId: ctx.tenantId,
    role: (ctx.user as { role?: string | null }).role,
    access: ctx.access,
  })),
  protectedMutation: protectedProcedure.mutation(({ ctx }) => ctx.tenantId),
  guarded: guardedProcedure({ [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] }).query(() => 'ok'),
  open: publicProcedure.query(() => 'open'),
});
const caller = (ctx: Context) => testRouter.createCaller(ctx);

const PERMISSIONS_VERSION_HEADER = HEADERS.PERMISSIONS_VERSION;

function headersOf(ctx: Context): Record<string, string> {
  return (ctx.res as unknown as { headers: Record<string, string> }).headers;
}

async function roleIdOf(tenantId: string, name: string): Promise<string> {
  const [row] = await db
    .select({ id: role.id })
    .from(role)
    .where(and(eq(role.tenantId, tenantId), eq(role.name, name)));
  return row!.id;
}

type Tenant = { id: string; slug: string; name: string };
type UserOverrides = { role?: string; mustChangePassword?: boolean; isPlatformAdmin?: boolean };

// `tenant` is what createContext would resolve from the session's active organization, so tests
// pass it explicitly; `activeOrganizationId` defaults to it and can be overridden to model a
// session pointing at an organization that no longer exists.
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
            opts.activeOrganizationId === undefined
              ? (tenant?.id ?? null)
              : opts.activeOrganizationId,
        },
        user: {
          id: user.id,
          role: opts.role ?? 'admin',
          mustChangePassword: opts.mustChangePassword ?? false,
          isPlatformAdmin: opts.isPlatformAdmin ?? false,
        },
      }
    : null;
  const headers: Record<string, string> = {};
  const res = {
    headers,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
  };
  return { req: {}, res, session, tenant } as unknown as Context;
}

async function setup() {
  const a = { ...(await createTestTenant('tenant-a', 'Tenant A')), name: 'Tenant A' };
  const b = { ...(await createTestTenant('tenant-b', 'Tenant B')), name: 'Tenant B' };
  return { a, b };
}

describe('tenant-aware procedure chain', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('authedProcedure: no session -> UNAUTHORIZED', async () => {
    await expect(caller(ctxFor(null, null)).authedOnly()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('authedProcedure: passes with a session even without an active organization', async () => {
    const u = await createTestUser();
    await expect(caller(ctxFor(null, u)).authedOnly()).resolves.toBe(u.id);
  });

  it('tenantProcedure: no session -> UNAUTHORIZED', async () => {
    const { a } = await setup();
    await expect(caller(ctxFor(a, null)).tenantOnly()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('tenantProcedure: session without an active organization -> FORBIDDEN TENANT_NOT_SELECTED', async () => {
    const u = await createTestUser();
    const err = await caller(ctxFor(null, u))
      .tenantOnly()
      .catch((e) => e);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.cause?.code).toBe('TENANT_NOT_SELECTED');
  });

  it('tenantProcedure: active organization that no longer exists -> NOT_FOUND TENANT_NOT_FOUND', async () => {
    const u = await createTestUser();
    const err = await caller(ctxFor(null, u, { activeOrganizationId: 'gone' }))
      .tenantOnly()
      .catch((e) => e);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.cause?.code).toBe('TENANT_NOT_FOUND');
  });

  it('tenantProcedure: exposes the tenant of the session', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await expect(caller(ctxFor(a, u)).tenantOnly()).resolves.toBe(a.id);
  });

  it('protected: no session -> UNAUTHORIZED (session is checked before tenant)', async () => {
    await expect(caller(ctxFor(null, null)).protectedQuery()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('protected: no active organization -> TENANT_NOT_SELECTED before any membership check', async () => {
    const u = await createTestUser();
    const err = await caller(ctxFor(null, u))
      .protectedQuery()
      .catch((e) => e);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.cause?.code).toBe('TENANT_NOT_SELECTED');
  });

  it('protected: a member removed from the active organization -> FORBIDDEN on the next call', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id);
    await expect(caller(ctxFor(a, u)).protectedQuery()).resolves.toMatchObject({ tenantId: a.id });
    await db.delete(member).where(eq(member.userId, u.id));
    const err = await caller(ctxFor(a, u))
      .protectedQuery()
      .catch((e) => e);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.cause).toBeUndefined();
  });

  it('protected: a member of A whose session is active in B -> FORBIDDEN', async () => {
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

  it('protected: no permissions version header when mustChangePassword rejects', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    const ctx = ctxFor(a, u, { mustChangePassword: true });
    await expect(caller(ctx).protectedQuery()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(headersOf(ctx)[PERMISSIONS_VERSION_HEADER]).toBeUndefined();
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
    it('without membership passes as owner (legacy role untouched) and logs the first access of the session', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      const ctx = ctxFor(a, p, { isPlatformAdmin: true, role: 'user', sessionId: 's1' });
      await expect(caller(ctx).protectedQuery()).resolves.toEqual({
        tenantId: a.id,
        role: 'user',
        access: { isOwner: true, grants: {}, roleId: null, roleName: null, roleVersion: null },
      });
      expect(headersOf(ctx)[PERMISSIONS_VERSION_HEADER]).toBe('owner:0');
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
      await addMember(p.id, a.id, 'operator');
      const ctx = ctxFor(a, p, { isPlatformAdmin: true, role: 'operator' });
      await expect(caller(ctx).protectedQuery()).resolves.toMatchObject({
        access: { isOwner: false, roleId: await roleIdOf(a.id, 'Operator') },
      });
      await caller(ctx).protectedMutation();
      expect(
        await db.select().from(platformAccessLog).where(eq(platformAccessLog.userId, p.id)),
      ).toHaveLength(0);
    });

    it('mustChangePassword still blocks and writes no row', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      await expect(
        caller(ctxFor(a, p, { isPlatformAdmin: true, mustChangePassword: true })).protectedQuery(),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(await db.select().from(platformAccessLog)).toHaveLength(0);
    });

    it('guardedProcedure evaluates permissions with owner access', async () => {
      const { a } = await setup();
      const p = await createTestUser({ isPlatformAdmin: true });
      await expect(
        caller(ctxFor(a, p, { isPlatformAdmin: true, role: 'user' })).guarded(),
      ).resolves.toBe('ok');
    });
  });

  it('guardedProcedure denies a member whose membership role lacks the permission, whatever user.role says', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'member');
    const ctx = ctxFor(a, u, { role: 'superadmin' });
    await expect(caller(ctx).guarded()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(headersOf(ctx)[PERMISSIONS_VERSION_HEADER]).toBe(`${await roleIdOf(a.id, 'Member')}:1`);
  });

  it('guardedProcedure allows a member whose membership role grants the permission, whatever user.role says', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await expect(caller(ctxFor(a, u, { role: 'member' })).guarded()).resolves.toBe('ok');
  });

  it('guardedProcedure decides by the role of the active organization', async () => {
    const { a, b } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await addMember(u.id, b.id, 'operator');
    await expect(caller(ctxFor(a, u)).guarded()).resolves.toBe('ok');
    await expect(caller(ctxFor(b, u)).guarded()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('protected: a member whose role belongs to another organization is FORBIDDEN (fail closed)', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await pointMemberAtForeignRole(u.id, a.id);
    const err = await caller(ctxFor(a, u))
      .protectedQuery()
      .catch((e) => e);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.cause).toBeUndefined();
  });

  it('protected: sets the permissions version header for a member', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'operator');
    const ctx = ctxFor(a, u);
    await caller(ctx).protectedMutation();
    expect(headersOf(ctx)[PERMISSIONS_VERSION_HEADER]).toBe(
      `${await roleIdOf(a.id, 'Operator')}:1`,
    );
  });

  it('publicProcedure is unaffected by the tenant chain', async () => {
    await expect(caller(ctxFor(null, null)).open()).resolves.toBe('open');
  });
});
