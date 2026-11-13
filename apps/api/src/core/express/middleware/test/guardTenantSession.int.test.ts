import type { NextFunction, Request, Response } from 'express';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import { ACTIONS, RESOURCES, type PermissionCheck, type RoleType } from '@repo/guards';
import { db, type Database, type TenantRunner } from '../../../../db';
import * as schema from '../../../../db/schema';
import {
  clients,
  member,
  organization,
  platformAccessLog,
  role,
  rolePermission,
  user,
} from '../../../../db/schema';
import { auth } from '../../../../lib/auth';
import { invalidateTenantCache } from '../../../../lib/tenancy/tenantResolver';
import {
  createUserWithPassword,
  signInCookie,
  signInWithActiveOrg,
} from '../../../../test/authHelpers';
import {
  addMember,
  createTestTenant,
  pointMemberAtForeignRole,
  resetDb,
} from '../../../../test/db';
import { testAppDatabaseUrl } from '../../../../test/roles';
import { guardedProcedure, router } from '../../../trpc/trpc';
import { createContext } from '../../../trpc/context';
import { guardTenantSession } from '../guardTenantSession';

const NEEDS: PermissionCheck = { [RESOURCES.TAX_RATES]: [ACTIONS.UPDATE] };
const UPLOAD: PermissionCheck = { [RESOURCES.PAYMENT]: [ACTIONS.UPLOAD_ATTACHMENT] };

function trpcContext(cookie?: string) {
  return createContext({
    req: { headers: cookie ? { cookie } : {} },
    res: { setHeader: () => undefined },
  } as unknown as CreateExpressContextOptions);
}

type Opts = { role?: string; isPlatformAdmin?: boolean; mustChangePassword?: boolean };

type Call = {
  status: number | null;
  body: unknown;
  next: Mock<NextFunction>;
  locals: Record<string, unknown>;
};

async function run(
  guard: ReturnType<typeof guardTenantSession>,
  req: { cookie?: string; method?: string } = {},
): Promise<Call> {
  const headers: Record<string, string> = {};
  if (req.cookie) headers['cookie'] = req.cookie;
  const locals: Record<string, unknown> = {};
  const out: Call = { status: null, body: undefined, next: vi.fn<NextFunction>(), locals };
  const res = {
    locals,
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: unknown) {
      out.body = body;
      return this;
    },
  } as unknown as Response;
  const request = {
    headers,
    method: req.method ?? 'GET',
    baseUrl: '/api/uploads',
    path: '/event-payments/p1/attachments',
  } as unknown as Request;
  await guard(request, res, out.next as unknown as NextFunction);
  return out;
}

async function setup() {
  const a = await createTestTenant('tenant-a');
  const b = await createTestTenant('tenant-b');
  return { a, b };
}

describe('guardTenantSession', () => {
  const guard = guardTenantSession(NEEDS);

  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => vi.restoreAllMocks());

  it('401 without a session, before anything else', async () => {
    await setup();
    const r = await run(guard);
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ errorCode: 'UNAUTHORIZED' });
    expect(r.next).not.toHaveBeenCalled();
  });

  it('403 TENANT_NOT_SELECTED when the session has no active organization', async () => {
    const { a, b } = await setup();
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, a.id);
    await addMember(id, b.id);
    const cookie = await signInCookie('m@test.local');
    const r = await run(guard, { cookie });
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ errorCode: 'TENANT_NOT_SELECTED' });
    expect(r.next).not.toHaveBeenCalled();
    expect(r.locals['tenantId']).toBeUndefined();
  });

  it('404 TENANT_NOT_FOUND when the active organization no longer exists', async () => {
    const { a } = await setup();
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, a.id);
    const cookie = await signInCookie('m@test.local');
    await db.delete(member);
    await db.delete(role).where(eq(role.tenantId, a.id));
    await db.delete(organization).where(eq(organization.id, a.id));
    invalidateTenantCache();
    const r = await run(guard, { cookie });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ errorCode: 'TENANT_NOT_FOUND' });
    expect(r.next).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN for a member removed from the active organization (checked on every request)', async () => {
    const { a } = await setup();
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, a.id, 'admin');
    const cookie = await signInCookie('m@test.local');
    const before = await run(guard, { cookie });
    expect(before.next).toHaveBeenCalledTimes(1);
    await db.delete(member);
    const r = await run(guard, { cookie });
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ errorCode: 'FORBIDDEN' });
    expect(r.next).not.toHaveBeenCalled();
    expect(r.locals['tenantId']).toBeUndefined();
    expect(r.locals['userId']).toBeUndefined();
  });

  it('403 FORBIDDEN for a member whose membership role lacks the permission, whatever user.role says', async () => {
    const { a } = await setup();
    const id = await createUserWithPassword('m@test.local', { role: 'superadmin' });
    await addMember(id, a.id, 'member');
    const cookie = await signInCookie('m@test.local');
    const r = await run(guard, { cookie });
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ errorCode: 'FORBIDDEN' });
    expect(r.next).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN for a member whose role belongs to another organization (fail closed)', async () => {
    const { a } = await setup();
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, a.id, 'admin');
    await pointMemberAtForeignRole(id, a.id);
    const cookie = await signInCookie('m@test.local');
    const r = await run(guard, { cookie });
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ errorCode: 'FORBIDDEN' });
    expect(r.next).not.toHaveBeenCalled();
  });

  it('calls next with tenantId and userId for a member whose membership role has the permission', async () => {
    const { a } = await setup();
    const id = await createUserWithPassword('m@test.local', { role: 'member' });
    await addMember(id, a.id, 'admin');
    const cookie = await signInCookie('m@test.local');
    const r = await run(guard, { cookie, method: 'POST' });
    expect(r.status).toBeNull();
    expect(r.next).toHaveBeenCalledTimes(1);
    expect(r.locals).toMatchObject({ tenantId: a.id, userId: id });
    expect(await db.select().from(platformAccessLog)).toHaveLength(0);
  });

  it('403 USER_MUST_CHANGE_PASSWORD for a member that must change password', async () => {
    const { a } = await setup();
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, a.id);
    const cookie = await signInCookie('m@test.local');
    await db.update(user).set({ mustChangePassword: true }).where(eq(user.id, id));
    const r = await run(guard, { cookie });
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ errorCode: 'USER_MUST_CHANGE_PASSWORD' });
    expect(r.next).not.toHaveBeenCalled();
  });

  describe('platform admin without membership', () => {
    it('passes as owner: one row for the first GET, then one per mutation', async () => {
      const { a } = await setup();
      // A global role without the permission proves owner access is the effective one.
      const id = await createUserWithPassword('root@test.local', {
        role: 'user',
        isPlatformAdmin: true,
      });
      const cookie = await signInWithActiveOrg('root@test.local', id, a.id);

      const g1 = await run(guard, { cookie, method: 'GET' });
      const g2 = await run(guard, { cookie, method: 'GET' });
      const p1 = await run(guard, { cookie, method: 'POST' });
      const p2 = await run(guard, { cookie, method: 'DELETE' });

      for (const r of [g1, g2, p1, p2]) {
        expect(r.next).toHaveBeenCalledTimes(1);
        expect(r.locals['tenantId']).toBe(a.id);
      }
      const rows = await db.select().from(platformAccessLog);
      expect(rows.map((r) => r.type).sort()).toEqual(['mutation', 'mutation', 'query']);
      expect(rows[0]).toMatchObject({
        tenantId: a.id,
        path: '/api/uploads/event-payments/p1/attachments',
      });
    });

    it('fails closed: a failing audit insert answers 500 and never calls next', async () => {
      const { a } = await setup();
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      const cookie = await signInWithActiveOrg('root@test.local', id, a.id);
      // The audit row is written in a transaction of its own.
      vi.spyOn(db, 'transaction').mockRejectedValueOnce(new Error('audit insert failed secret-detail'));
      const r = await run(guard, { cookie, method: 'POST' });
      expect(r.status).toBe(500);
      expect(r.body).toEqual({ errorCode: 'INTERNAL_ERROR' });
      expect(r.next).not.toHaveBeenCalled();
      expect(r.locals['tenantId']).toBeUndefined();
    });

    it('does not write audit rows when the platform admin is also a member', async () => {
      const { a } = await setup();
      const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
      await addMember(id, a.id, 'admin');
      const cookie = await signInCookie('root@test.local');
      const r = await run(guard, { cookie, method: 'POST' });
      expect(r.next).toHaveBeenCalledTimes(1);
      expect(await db.select().from(platformAccessLog)).toHaveLength(0);
    });

    it('is blocked by mustChangePassword without writing a row', async () => {
      const { a } = await setup();
      const id = await createUserWithPassword('root@test.local', {
        isPlatformAdmin: true,
        mustChangePassword: true,
      });
      const cookie = await signInWithActiveOrg('root@test.local', id, a.id);
      const r = await run(guard, { cookie });
      expect(r.status).toBe(403);
      expect(r.body).toEqual({ errorCode: 'USER_MUST_CHANGE_PASSWORD' });
      expect(await db.select().from(platformAccessLog)).toHaveLength(0);
    });
  });

  it('answers 500 with a fixed body when something unexpected throws', async () => {
    await setup();
    vi.spyOn(auth.api, 'getSession').mockRejectedValue(new Error('boom leak'));
    const r = await run(guard);
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ errorCode: 'INTERNAL_ERROR' });
    expect(r.next).not.toHaveBeenCalled();
  });
});

describe('parity with the tRPC chain', () => {
  const testRouter = router({ guarded: guardedProcedure(NEEDS).query(() => 'ok') });
  const guard = guardTenantSession(NEEDS);

  beforeEach(async () => {
    await resetDb();
  });

  // Explicit on both sides so a change of status or code in either transport fails here.
  const EXPRESS_STATUS = {
    UNAUTHORIZED: 401,
    TENANT_NOT_SELECTED: 403,
    TENANT_NOT_FOUND: 404,
    FORBIDDEN: 403,
    USER_MUST_CHANGE_PASSWORD: 403,
  } as const;
  const TRPC_EQUIVALENT = {
    UNAUTHORIZED: { code: 'UNAUTHORIZED', cause: undefined },
    TENANT_NOT_SELECTED: { code: 'FORBIDDEN', cause: 'TENANT_NOT_SELECTED' },
    TENANT_NOT_FOUND: { code: 'NOT_FOUND', cause: 'TENANT_NOT_FOUND' },
    FORBIDDEN: { code: 'FORBIDDEN', cause: undefined },
    USER_MUST_CHANGE_PASSWORD: { code: 'FORBIDDEN', cause: 'USER_MUST_CHANGE_PASSWORD' },
  } as const;

  // Each scenario builds the session state, then both transports must reach the same verdict.
  type Scenario = {
    name: string;
    user: Opts;
    // Role of the membership in A (and B for 'multi'); defaults to 'admin', which has NEEDS.
    memberRole?: RoleType;
    // 'member' = member of A with A active; 'removed' = A active but membership gone;
    // 'none' = platform admin without membership; 'multi' = several memberships, none active;
    // 'ghost' = A active but the organization was deleted; 'foreign' = A active, member of B only;
    // 'norole' = member of A with A active whose role_id points at another organization's role.
    state: 'member' | 'removed' | 'none' | 'multi' | 'ghost' | 'foreign' | 'norole';
    anonymous?: boolean;
    // Express errorCode both transports must produce, or null when the request is allowed.
    denial: keyof typeof TRPC_EQUIVALENT | null;
  };

  const scenarios: Scenario[] = [
    { name: 'member with permission', user: {}, state: 'member', denial: null },
    {
      name: 'member without permission',
      user: { role: 'superadmin' },
      memberRole: 'member',
      state: 'member',
      denial: 'FORBIDDEN',
    },
    { name: 'member without a role', user: {}, state: 'norole', denial: 'FORBIDDEN' },
    {
      name: 'member removed from the active organization',
      user: {},
      state: 'removed',
      denial: 'FORBIDDEN',
    },
    {
      name: 'member of another organization only',
      user: {},
      state: 'foreign',
      denial: 'FORBIDDEN',
    },
    {
      name: 'must change password',
      user: { mustChangePassword: true },
      state: 'member',
      denial: 'USER_MUST_CHANGE_PASSWORD',
    },
    {
      name: 'platform admin without membership',
      user: { isPlatformAdmin: true, role: 'user' },
      state: 'none',
      denial: null,
    },
    {
      name: 'platform admin member keeps own role',
      user: { isPlatformAdmin: true, role: 'superadmin' },
      memberRole: 'member',
      state: 'member',
      denial: 'FORBIDDEN',
    },
    { name: 'no active organization', user: {}, state: 'multi', denial: 'TENANT_NOT_SELECTED' },
    { name: 'active organization deleted', user: {}, state: 'ghost', denial: 'TENANT_NOT_FOUND' },
    { name: 'no session', user: {}, state: 'member', anonymous: true, denial: 'UNAUTHORIZED' },
  ];

  it.each(scenarios)('same verdict: $name', async (s) => {
    const { a, b } = await setup();
    const id = await createUserWithPassword('u@test.local', {
      ...s.user,
      mustChangePassword: false,
    });
    const memberRole = s.memberRole ?? 'admin';
    await addMember(id, a.id, memberRole);
    if (s.state === 'multi') await addMember(id, b.id, memberRole);
    const cookie = await signInWithActiveOrg('u@test.local', id, s.state === 'multi' ? null : a.id);
    if (s.state === 'removed' || s.state === 'none') await db.delete(member);
    if (s.state === 'foreign') {
      await db.delete(member);
      await addMember(id, b.id, memberRole);
    }
    if (s.state === 'norole') await pointMemberAtForeignRole(id, a.id);
    if (s.state === 'ghost') {
      await db.delete(member);
      await db.delete(role).where(eq(role.tenantId, a.id));
      await db.delete(organization).where(eq(organization.id, a.id));
      invalidateTenantCache();
    }
    await db
      .update(user)
      .set({ mustChangePassword: s.user.mustChangePassword ?? false })
      .where(eq(user.id, id));

    const sent = s.anonymous ? undefined : cookie;
    const express = await run(guard, { cookie: sent });

    const ctx = await trpcContext(sent);
    const trpcError = await testRouter
      .createCaller(ctx)
      .guarded()
      .then(() => null)
      .catch((e: { code: string; cause?: { code?: string } }) => e);

    const expressCode =
      express.next.mock.calls.length === 1
        ? null
        : (express.body as { errorCode: string }).errorCode;
    expect(expressCode).toBe(s.denial);
    if (s.denial === null) {
      expect(trpcError).toBeNull();
      return;
    }
    expect(express.status).toBe(EXPRESS_STATUS[s.denial]);
    expect({ code: trpcError?.code, cause: trpcError?.cause?.code }).toEqual(
      TRPC_EQUIVALENT[s.denial],
    );
  });
});

describe('attachment upload parity with the tRPC chain', () => {
  const testRouter = router({ upload: guardedProcedure(UPLOAD).mutation(() => 'ok') });
  const guard = guardTenantSession(UPLOAD);

  beforeEach(async () => {
    await resetDb();
  });

  async function verdicts(cookie: string) {
    const express = await run(guard, { cookie, method: 'POST' });
    const trpc = await testRouter
      .createCaller(await trpcContext(cookie))
      .upload()
      .then(() => 'allowed')
      .catch((e: { code: string }) => e.code);
    return { express: express.next.mock.calls.length === 1 ? 'allowed' : express.status, trpc };
  }

  it('a role without payment.upload_attachment is 403 in Express and FORBIDDEN in tRPC', async () => {
    const a = await createTestTenant('tenant-a');
    const id = await createUserWithPassword('op@test.local', { role: 'superadmin' });
    await addMember(id, a.id, 'operator');
    const cookie = await signInCookie('op@test.local');
    await expect(verdicts(cookie)).resolves.toEqual({ express: 403, trpc: 'FORBIDDEN' });
  });

  it('a role with payment.upload_attachment is allowed by both', async () => {
    const a = await createTestTenant('tenant-a');
    const id = await createUserWithPassword('ad@test.local', { role: 'member' });
    await addMember(id, a.id, 'admin');
    const cookie = await signInCookie('ad@test.local');
    await expect(verdicts(cookie)).resolves.toEqual({ express: 'allowed', trpc: 'allowed' });
  });

  it('revoking the permission from the role denies both on the next request', async () => {
    const a = await createTestTenant('tenant-a');
    const id = await createUserWithPassword('ad@test.local');
    await addMember(id, a.id, 'admin');
    const cookie = await signInCookie('ad@test.local');
    await expect(verdicts(cookie)).resolves.toEqual({ express: 'allowed', trpc: 'allowed' });

    const [admin] = await db
      .select({ id: role.id })
      .from(role)
      .where(and(eq(role.tenantId, a.id), eq(role.name, 'Admin')));
    await db
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, admin!.id),
          eq(rolePermission.resource, RESOURCES.PAYMENT),
          eq(rolePermission.action, ACTIONS.UPLOAD_ATTACHMENT),
        ),
      );

    await expect(verdicts(cookie)).resolves.toEqual({ express: 403, trpc: 'FORBIDDEN' });
  });
});

describe('guardTenantSession with the app role', () => {
  let appClient: ReturnType<typeof postgres>;
  let appDb: Database;

  beforeAll(() => {
    appClient = postgres(testAppDatabaseUrl(), { max: 2 });
    appDb = drizzle(appClient, { schema }) as unknown as Database;
  });
  afterAll(async () => {
    await appClient?.end();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => vi.restoreAllMocks());

  async function seedClients() {
    const { a, b } = await setup();
    await db.insert(clients).values([
      { tenantId: a.id, name: 'Client A' },
      { tenantId: b.id, name: 'Client B' },
    ]);
    return { a, b };
  }

  it('resolves a member through RLS and hands the route a runner scoped to the session tenant', async () => {
    const { a } = await seedClients();
    const id = await createUserWithPassword('m@test.local', { role: 'member' });
    await addMember(id, a.id, 'admin');
    const cookie = await signInCookie('m@test.local');

    const r = await run(guardTenantSession(NEEDS, appDb), { cookie, method: 'POST' });
    expect(r.next).toHaveBeenCalledTimes(1);
    expect(r.locals).toMatchObject({ tenantId: a.id, userId: id });

    const runInTenant = r.locals['runInTenant'] as TenantRunner;
    const seen = await runInTenant((tx) => tx.select({ name: clients.name }).from(clients));
    expect(seen).toEqual([{ name: 'Client A' }]);
    // Outside the runner no tenant is set, so the app role sees nothing.
    expect(await appDb.select().from(clients)).toEqual([]);
  });

  it('still refuses a member whose role lacks the permission', async () => {
    const { a } = await seedClients();
    const id = await createUserWithPassword('m@test.local');
    await addMember(id, a.id, 'member');
    const cookie = await signInCookie('m@test.local');
    const r = await run(guardTenantSession(NEEDS, appDb), { cookie });
    expect(r.status).toBe(403);
    expect(r.next).not.toHaveBeenCalled();
  });

  it('admits a platform admin as owner and writes the audit row under RLS', async () => {
    const { a } = await seedClients();
    const id = await createUserWithPassword('root@test.local', { isPlatformAdmin: true });
    const cookie = await signInWithActiveOrg('root@test.local', id, a.id);
    const r = await run(guardTenantSession(NEEDS, appDb), { cookie, method: 'POST' });
    expect(r.next).toHaveBeenCalledTimes(1);
    expect(await db.select().from(platformAccessLog)).toMatchObject([
      { tenantId: a.id, userId: id, type: 'mutation' },
    ]);
  });
});
