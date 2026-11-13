import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { TRPCError } from '@trpc/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type Database } from '../../../db';
import * as schema from '../../../db/schema';
import { member, platformAccessLog, rescheduleReasons, role } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { seedTenantRoles } from '../../../lib/rbac/seedTenantRoles';
import { TEST_APP_ROLE, testAppDatabaseUrl } from '../../../test/roles';
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
  shortTxProcedure,
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
  opts: {
    activeOrganizationId?: string | null;
    sessionId?: string;
    database?: Database;
  } & UserOverrides = {},
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
  return { req: {}, res, session, tenant, database: opts.database } as unknown as Context;
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

      // The audit row is written in its own transaction, the first one a platform request opens.
      const failNextInsert = () => {
        const real = db.transaction.bind(db);
        let calls = 0;
        return vi.spyOn(db, 'transaction').mockImplementation(((fn: never) => {
          calls += 1;
          if (calls === 1) return Promise.reject(new Error('audit insert failed'));
          return real(fn);
        }) as typeof db.transaction);
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

const IDLE_IN_TX = sql`
  select count(*)::int as n from pg_stat_activity
  where usename = ${TEST_APP_ROLE} and state like 'idle in transaction%'`;

async function appConnectionsIdleInTx(): Promise<number> {
  const rows = (await db.execute(IDLE_IN_TX)) as unknown as { n: number }[];
  return rows[0]!.n;
}

// Rows each afterCommit task saw from another connection, so only committed writes count.
let afterCommitRuns: Promise<number>[] = [];
const scheduleCount = (name: string) => () => {
  afterCommitRuns.push(
    db
      .select()
      .from(rescheduleReasons)
      .where(eq(rescheduleReasons.name, name))
      .then((rows) => rows.length),
  );
};

const txRouter = router({
  writeWithAfterCommit: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.afterCommit(scheduleCount('after commit'));
    await ctx.db.insert(rescheduleReasons).values({ tenantId: ctx.tenantId, name: 'after commit' });
    // Not run yet: the transaction is still open.
    return afterCommitRuns.length;
  }),
  writeWithFailingAfterCommit: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.afterCommit(() => {
      throw new Error('task failed');
    });
    ctx.afterCommit(scheduleCount('survives a failing task'));
    await ctx.db
      .insert(rescheduleReasons)
      .values({ tenantId: ctx.tenantId, name: 'survives a failing task' });
    return 'ok';
  }),
  failWithAfterCommit: protectedProcedure.mutation(async ({ ctx }) => {
    ctx.afterCommit(scheduleCount('never'));
    throw new TRPCError({ code: 'CONFLICT' });
  }),
  currentTenant: protectedProcedure.query(async ({ ctx }) => {
    const rows = (await ctx.db.execute(
      sql`select current_setting('app.tenant_id', true) as v`,
    )) as unknown as { v: string | null }[];
    return rows[0]!.v;
  }),
  writeThenFail: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.insert(rescheduleReasons).values({ tenantId: ctx.tenantId, name: 'rolled back' });
    throw new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.client.IN_USE) });
  }),
  writeThenSucceed: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.insert(rescheduleReasons).values({ tenantId: ctx.tenantId, name: 'kept' });
    return 'ok';
  }),
  allRoles: protectedProcedure.query(({ ctx }) =>
    ctx.db.select({ tenantId: role.tenantId }).from(role),
  ),
  misconfiguredShortTx: protectedProcedure.meta({ shortTx: true }).query(() => 'ran'),
  idleInTxDuringLongRequest: protectedProcedure.query(() => appConnectionsIdleInTx()),
  idleInTxDuringShortRequest: shortTxProcedure.query(async ({ ctx }) => {
    // @ts-expect-error a short-transaction procedure exposes no request transaction
    void ctx.db;
    const during = await appConnectionsIdleInTx();
    const seen = await ctx.runInTenant(async (tx) => {
      const rows = (await tx.execute(
        sql`select current_setting('app.tenant_id', true) as v`,
      )) as unknown as { v: string | null }[];
      return rows[0]!.v;
    });
    return { during, seen, access: ctx.access };
  }),
});

describe('request transaction (app role)', () => {
  let appClient: postgres.Sql;
  let appDb: Database;

  beforeAll(() => {
    // A single connection: a request that held its transaction while waiting on a second one
    // (the platform audit) would hang instead of passing.
    appClient = postgres(testAppDatabaseUrl(), { max: 1, onnotice: () => {} });
    appDb = drizzle(appClient, { schema }) as unknown as Database;
  });
  afterAll(async () => {
    await appClient?.end();
  });
  beforeEach(async () => {
    await resetDb();
  });

  const txCaller = (ctx: Context) => txRouter.createCaller(ctx);

  async function viaHttp(path: string, ctx: Context) {
    const res = await fetchRequestHandler({
      endpoint: '/trpc',
      req: new Request(`http://localhost/trpc/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
      router: txRouter,
      createContext: () => ctx,
    });
    return { status: res.status, body: JSON.parse(await res.text()) };
  }

  it('runs the procedure with the session tenant set on the transaction', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await expect(txCaller(ctxFor(a, u, { database: appDb })).currentTenant()).resolves.toBe(a.id);
  });

  it('runs afterCommit tasks once the transaction has committed, and never after a rollback', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    afterCommitRuns = [];
    const caller = txCaller(ctxFor(a, u, { database: appDb }));

    await expect(caller.writeWithAfterCommit()).resolves.toBe(0);
    expect(await Promise.all(afterCommitRuns)).toEqual([1]);

    afterCommitRuns = [];
    await expect(caller.failWithAfterCommit()).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(afterCommitRuns).toEqual([]);
  });

  it('a failing afterCommit task is logged, keeps the committed response and the later tasks', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    afterCommitRuns = [];
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      txCaller(ctxFor(a, u, { database: appDb })).writeWithFailingAfterCommit(),
    ).resolves.toBe('ok');

    expect(await Promise.all(afterCommitRuns)).toEqual([1]);
    expect(errors).toHaveBeenCalledWith('after-commit task failed', expect.any(Error));
    errors.mockRestore();
  });

  it('commits the work of a successful procedure', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await txCaller(ctxFor(a, u, { database: appDb })).writeThenSucceed();
    const rows = await db
      .select()
      .from(rescheduleReasons)
      .where(eq(rescheduleReasons.name, 'kept'));
    expect(rows).toHaveLength(1);
  });

  it('rolls back the work of a failing procedure and keeps the error the client sees', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    const { status, body } = await viaHttp('writeThenFail', ctxFor(a, u, { database: appDb }));
    expect(status).toBe(409);
    expect(body.error.data.code).toBe('CONFLICT');
    expect(body.error.data.errorCode).toBe(ErrorCodes.client.IN_USE);
    expect(
      await db.select().from(rescheduleReasons).where(eq(rescheduleReasons.name, 'rolled back')),
    ).toHaveLength(0);
  });

  it('shows a platform admin without membership only the rows of the chosen organization', async () => {
    const { a, b } = await setup();
    const p = await createTestUser({ isPlatformAdmin: true });
    await seedTenantRoles(a.id, db);
    await seedTenantRoles(b.id, db);
    const all = await db.select({ tenantId: role.tenantId }).from(role);
    expect(new Set(all.map((r) => r.tenantId))).toEqual(new Set([a.id, b.id]));
    const rows = await txCaller(
      ctxFor(a, p, { isPlatformAdmin: true, database: appDb }),
    ).allRoles();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === a.id)).toBe(true);
  });

  it('keeps the audit row of a platform access whose request fails', async () => {
    const { a } = await setup();
    const p = await createTestUser({ isPlatformAdmin: true });
    await expect(
      txCaller(ctxFor(a, p, { isPlatformAdmin: true, database: appDb })).writeThenFail(),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const rows = await db.select().from(platformAccessLog);
    expect(rows).toMatchObject([{ userId: p.id, tenantId: a.id, type: 'mutation' }]);
  });

  it('holds the request transaction open while the procedure runs', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await expect(
      txCaller(ctxFor(a, u, { database: appDb })).idleInTxDuringLongRequest(),
    ).resolves.toBe(1);
  });

  it('shortTxProcedure returns the connection before the procedure waits', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'operator');
    const result = await txCaller(ctxFor(a, u, { database: appDb })).idleInTxDuringShortRequest();
    expect(result.during).toBe(0);
    expect(result.seen).toBe(a.id);
    expect(result.access.roleId).toBe(await roleIdOf(a.id, 'Operator'));
  });

  it('shortTxProcedure applies the same access checks', async () => {
    const { a, b } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await expect(
      txCaller(ctxFor(b, u, { database: appDb })).idleInTxDuringShortRequest(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const err = await txCaller(ctxFor(a, u, { database: appDb, mustChangePassword: true }))
      .idleInTxDuringShortRequest()
      .catch((e) => e);
    expect(err.cause?.code).toBe('USER_MUST_CHANGE_PASSWORD');
  });

  it('refuses a protectedProcedure marked shortTx, whose ctx.db would not exist', async () => {
    const { a } = await setup();
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await expect(
      txCaller(ctxFor(a, u, { database: appDb })).misconfiguredShortTx(),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });

  it('a platform admin passes shortTxProcedure as owner and is audited', async () => {
    const { a } = await setup();
    const p = await createTestUser({ isPlatformAdmin: true });
    const result = await txCaller(
      ctxFor(a, p, { isPlatformAdmin: true, database: appDb, sessionId: 'short' }),
    ).idleInTxDuringShortRequest();
    expect(result.access.isOwner).toBe(true);
    expect(await db.select().from(platformAccessLog)).toHaveLength(1);
  });
});
