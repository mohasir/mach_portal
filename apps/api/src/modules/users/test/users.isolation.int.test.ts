import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, like } from 'drizzle-orm';
import { usersListQuerySchema } from '@repo/schemas';
import type { TenantCtx } from '../../../core/trpc/tenantCtx';
import {
  account,
  member,
  platformAccessLog,
  session,
  user,
  verification,
} from '../../../db/schema';
import { env } from '../../../env';
import { auth } from '../../../lib/auth';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { createUserWithPassword } from '../../../test/authHelpers';
import {
  addMember,
  createTestUser,
  resetDb,
  seedTwoTenants,
  testDb,
  type TestTenant,
} from '../../../test/db';
import { UsersRepository } from '../users.repository';
import { usersModule } from '../users.module';

const listAll = usersListQuerySchema.parse({});

function moduleFor(tenant: TestTenant, isPlatformAdmin = false) {
  return usersModule({
    tenantId: tenant.id,
    user: { id: randomUUID(), isPlatformAdmin },
  } as unknown as TenantCtx);
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => {
      throw new Error(`expected ${code}, got success`);
    },
    (e: unknown) => e,
  );
  expect((err as { cause?: unknown }).cause).toBeInstanceOf(AppError);
  expect(((err as { cause: AppError }).cause as AppError).code).toBe(code);
}

async function memberRows(userId: string) {
  return testDb
    .select({ organizationId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, userId));
}

async function memberRole(userId: string, tenantId: string) {
  const [row] = await testDb
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, tenantId)));
  return row?.role;
}

async function userRow(userId: string) {
  const [row] = await testDb.select().from(user).where(eq(user.id, userId));
  return row;
}

async function setupTokens(userId: string) {
  return testDb
    .select()
    .from(verification)
    .where(and(eq(verification.value, userId), like(verification.identifier, 'reset-password:%')));
}

async function passwordHash(userId: string) {
  const [row] = await testDb
    .select({ password: account.password })
    .from(account)
    .where(eq(account.userId, userId));
  return row?.password;
}

async function insertSession(userId: string, activeOrganizationId: string | null) {
  const id = randomUUID();
  await testDb.insert(session).values({
    id,
    token: randomUUID(),
    userId,
    activeOrganizationId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    updatedAt: new Date(),
  });
  return id;
}

async function sessionOrgs(userId: string) {
  const rows = await testDb
    .select({ org: session.activeOrganizationId })
    .from(session)
    .where(eq(session.userId, userId));
  return rows.map((r) => r.org).sort();
}

describe('users tenant isolation (membership scope)', () => {
  let a: TestTenant;
  let b: TestTenant;
  let onlyA: string;
  let onlyB: string;
  let shared: string;
  let superA: string;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    onlyA = (await createTestUser({ email: 'only-a@test.local', role: 'admin' })).id;
    await addMember(onlyA, a.id, 'admin');
    onlyB = (await createTestUser({ email: 'only-b@test.local', role: 'operator' })).id;
    await addMember(onlyB, b.id, 'operator');
    shared = (await createTestUser({ email: 'shared@test.local', role: 'admin' })).id;
    await addMember(shared, a.id, 'admin');
    await addMember(shared, b.id, 'operator');
    superA = (await createTestUser({ email: 'super-a@test.local', role: 'superadmin' })).id;
    await addMember(superA, a.id, 'superadmin');
  });

  describe('repository reads', () => {
    it('findPaginated lists only members of the tenant', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      const resA = await repoA.findPaginated(listAll, 'superadmin');
      expect(resA.items.map((u) => u.id).sort()).toEqual([a.userId, onlyA, shared, superA].sort());

      const repoB = new UsersRepository(testDb, b.id);
      const resB = await repoB.findPaginated(listAll, 'superadmin');
      expect(resB.items.map((u) => u.id).sort()).toEqual([b.userId, onlyB, shared].sort());
    });

    it('shows the member role of each tenant for a shared user', async () => {
      const resA = await new UsersRepository(testDb, a.id).findPaginated(listAll, 'superadmin');
      const resB = await new UsersRepository(testDb, b.id).findPaginated(listAll, 'superadmin');
      expect(resA.items.find((u) => u.id === shared)?.role).toBe('admin');
      expect(resB.items.find((u) => u.id === shared)?.role).toBe('operator');
    });

    it('paginated total and search ignore users of other tenants', async () => {
      const res = await new UsersRepository(testDb, a.id).findPaginated(
        usersListQuerySchema.parse({ page: 1, pageSize: 10, search: 'only' }),
        'superadmin',
      );
      expect(res.items.map((u) => u.id)).toEqual([onlyA]);
      expect(res.total).toBe(1);

      const all = await new UsersRepository(testDb, a.id).findPaginated(
        usersListQuerySchema.parse({ page: 1, pageSize: 10 }),
        'superadmin',
      );
      expect(all.total).toBe(4);
    });

    it('hides superadmin members from non-superadmin callers, by the tenant role', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      const asAdmin = await repoA.findPaginated(
        usersListQuerySchema.parse({ page: 1, pageSize: 10 }),
        'admin',
      );
      expect(asAdmin.items.map((u) => u.id)).not.toContain(superA);
      expect(asAdmin.total).toBe(3);

      // Global role superadmin but plain member in B: visible in B as a member.
      await addMember(superA, b.id, 'member');
      const inB = await new UsersRepository(testDb, b.id).findPaginated(listAll, 'admin');
      expect(inB.items.find((u) => u.id === superA)?.role).toBe('member');
    });

    it('findById does not return users who are only members of another tenant', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.findById(onlyB)).toBeUndefined();
      expect((await repoA.findById(shared))?.id).toBe(shared);
      expect(await repoA.findById(randomUUID())).toBeUndefined();
    });

    it('sessionsCount counts only sessions active in the tenant', async () => {
      await insertSession(shared, a.id);
      await insertSession(shared, b.id);
      await insertSession(shared, b.id);
      await insertSession(shared, null);
      const resA = await new UsersRepository(testDb, a.id).findPaginated(listAll, 'superadmin');
      const resB = await new UsersRepository(testDb, b.id).findPaginated(listAll, 'superadmin');
      expect(resA.items.find((u) => u.id === shared)?.sessionsCount).toBe(1);
      expect(resB.items.find((u) => u.id === shared)?.sessionsCount).toBe(2);
    });
  });

  describe('repository writes', () => {
    it('updateUser cannot modify a user who is not a member of the tenant', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.updateUser(onlyB, { name: 'Hacked', role: 'superadmin' })).toBeUndefined();
      expect((await userRow(onlyB))?.role).toBe('operator');
      expect(await repoA.updateUser(shared, { name: 'Renamed' })).toEqual({ id: shared });
    });

    it('updateMemberRole and removeMembership only touch the tenant membership', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.updateMemberRole(onlyB, 'admin')).toBeUndefined();
      expect(await repoA.removeMembership(onlyB)).toBeUndefined();
      expect(await memberRows(onlyB)).toEqual([{ organizationId: b.id, role: 'operator' }]);
    });

    it('deleteTenantSessions only removes sessions active in the tenant', async () => {
      await insertSession(onlyB, b.id);
      await insertSession(onlyB, null);
      await new UsersRepository(testDb, a.id).deleteTenantSessions(onlyB);
      expect(await sessionOrgs(onlyB)).toEqual([b.id, null].sort());
    });

    it('deleteAccountWithoutMemberships keeps an account that still has a membership', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.deleteAccountWithoutMemberships(onlyB)).toBeUndefined();
      expect(await userRow(onlyB)).toBeDefined();
    });

    it('addMembership stamps the repository tenant', async () => {
      const orphan = (await createTestUser({ email: 'orphan@test.local' })).id;
      await new UsersRepository(testDb, a.id).addMembership(orphan, 'member');
      expect(await memberRows(orphan)).toEqual([{ organizationId: a.id, role: 'member' }]);
    });
  });

  describe('list (service)', () => {
    it('lists only tenant members with their tenant role', async () => {
      const res = await moduleFor(b).list(listAll, 'admin');
      expect(res.items.map((u) => u.email).sort()).toEqual(
        [(await userRow(b.userId))!.email, 'only-b@test.local', 'shared@test.local'].sort(),
      );
      expect(res.items.find((u) => u.id === shared)?.role).toBe('operator');
    });
  });

  describe('create', () => {
    it('(a) rejects an email that is already a member of the tenant', async () => {
      await expectAppError(
        moduleFor(a).create({ name: 'X', email: 'only-a@test.local', role: 'member' }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      await expectAppError(
        moduleFor(a).create({ name: 'X', email: 'Only-A@Test.Local', role: 'member' }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      expect(await memberRows(onlyA)).toEqual([{ organizationId: a.id, role: 'admin' }]);
    });

    it('(b) rejects a tenant admin adding an account of another tenant, changing nothing', async () => {
      const existing = await createUserWithPassword('real@test.local', { role: 'operator' });
      await addMember(existing, b.id, 'operator');
      const hashBefore = await passwordHash(existing);

      await expectAppError(
        moduleFor(a).create({ name: 'Other name', email: 'real@test.local', role: 'admin' }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      await expectAppError(
        moduleFor(a).create({ name: 'X', email: 'only-b@test.local', role: 'admin' }),
        ErrorCodes.user.ALREADY_EXISTS,
      );

      expect(await memberRows(existing)).toEqual([{ organizationId: b.id, role: 'operator' }]);
      expect(await memberRows(onlyB)).toEqual([{ organizationId: b.id, role: 'operator' }]);
      const after = await userRow(existing);
      expect(after?.role).toBe('operator');
      expect(after?.name).toBe('real@test.local');
      expect(after?.mustChangePassword).toBe(false);
      expect(await passwordHash(existing)).toBe(hashBefore);
      expect(await setupTokens(existing)).toHaveLength(0);
    });

    it('(b) rejects a tenant admin adding an account without any membership', async () => {
      const orphan = (await createTestUser({ email: 'orphan@test.local', role: 'member' })).id;
      await expectAppError(
        moduleFor(a).create({ name: 'O', email: 'orphan@test.local', role: 'operator' }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      expect(await memberRows(orphan)).toHaveLength(0);
      expect((await userRow(orphan))?.role).toBe('member');
    });

    it('(b) a platform admin adds an existing account of another tenant as a member only', async () => {
      const existing = await createUserWithPassword('real@test.local', { role: 'operator' });
      await addMember(existing, b.id, 'operator');
      const hashBefore = await passwordHash(existing);
      expect(hashBefore).toBeTruthy();

      const res = await moduleFor(a, true).create({
        name: 'Other name',
        email: 'real@test.local',
        role: 'admin',
      });

      expect(res.setupUrl).toBeNull();
      expect(res.user.id).toBe(existing);
      expect(res.user.role).toBe('admin');
      expect(await memberRole(existing, a.id)).toBe('admin');
      expect(await memberRole(existing, b.id)).toBe('operator');
      const after = await userRow(existing);
      expect(after?.mustChangePassword).toBe(false);
      expect(after?.role).toBe('operator');
      expect(after?.name).toBe('real@test.local');
      expect(await passwordHash(existing)).toBe(hashBefore);
      expect(await setupTokens(existing)).toHaveLength(0);
    });

    it('(b) keeps mustChangePassword of a pending account unchanged', async () => {
      const pending = await createUserWithPassword('pending@test.local', {
        role: 'member',
        mustChangePassword: true,
      });
      await addMember(pending, b.id, 'member');
      const res = await moduleFor(a, true).create({
        name: 'P',
        email: 'pending@test.local',
        role: 'member',
      });
      expect(res.setupUrl).toBeNull();
      expect((await userRow(pending))?.mustChangePassword).toBe(true);
      expect(await setupTokens(pending)).toHaveLength(0);
    });

    it('(b) mirrors the role on an account without any other membership', async () => {
      const orphan = (await createTestUser({ email: 'orphan@test.local', role: 'member' })).id;
      const res = await moduleFor(a, true).create({
        name: 'O',
        email: 'orphan@test.local',
        role: 'operator',
      });
      expect(res.setupUrl).toBeNull();
      expect((await userRow(orphan))?.role).toBe('operator');
      expect(await memberRole(orphan, a.id)).toBe('operator');
    });

    it('(b) never rewrites the global role of a platform admin', async () => {
      const pa = (
        await createTestUser({ email: 'pa@test.local', role: 'superadmin', isPlatformAdmin: true })
      ).id;
      const res = await moduleFor(a, true).create({
        name: 'P',
        email: 'pa@test.local',
        role: 'member',
      });
      expect(res.setupUrl).toBeNull();
      expect((await userRow(pa))?.role).toBe('superadmin');
      expect(await memberRole(pa, a.id)).toBe('member');
    });

    it('(c) creates a new account with membership and a setup link', async () => {
      const res = await moduleFor(a).create({
        name: 'New',
        email: 'new@test.local',
        role: 'operator',
      });
      expect(res.setupUrl).toMatch(
        new RegExp(`^${env.WEB_APP_URL}/set-password\\?token=[0-9a-f]+&reason=create$`),
      );
      const created = await userRow(res.user.id);
      expect(created?.email).toBe('new@test.local');
      expect(created?.role).toBe('operator');
      expect(created?.mustChangePassword).toBe(true);
      expect(await memberRows(res.user.id)).toEqual([{ organizationId: a.id, role: 'operator' }]);
      expect(await setupTokens(res.user.id)).toHaveLength(1);
      expect(res.user.role).toBe('operator');
    });

    it('(c) removes the new account when its membership cannot be written', async () => {
      const spy = vi
        .spyOn(UsersRepository.prototype, 'addMembership')
        .mockRejectedValueOnce(new Error('boom'));
      await expect(
        moduleFor(a).create({ name: 'F', email: 'fail@test.local', role: 'member' }),
      ).rejects.toThrow('boom');
      spy.mockRestore();
      expect(await testDb.select().from(user).where(eq(user.email, 'fail@test.local'))).toEqual([]);

      const retry = await moduleFor(a).create({
        name: 'F',
        email: 'fail@test.local',
        role: 'member',
      });
      expect(retry.setupUrl).not.toBeNull();
      expect(await memberRows(retry.user.id)).toEqual([{ organizationId: a.id, role: 'member' }]);
    });

    it('(c) does not add a second membership when the account was attached meanwhile', async () => {
      const original = auth.api.signUpEmail;
      const spy = vi.spyOn(auth.api, 'signUpEmail').mockImplementationOnce(async (args) => {
        const res = await original(args as Parameters<typeof original>[0]);
        await addMember(res.user.id, a.id, 'member');
        return res;
      });
      await expectAppError(
        moduleFor(a, true).create({ name: 'M', email: 'mid@test.local', role: 'member' }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      spy.mockRestore();
      const users = await testDb.select().from(user).where(eq(user.email, 'mid@test.local'));
      expect(users).toHaveLength(1);
      expect(await memberRows(users[0]!.id)).toHaveLength(1);
    });

    it('(c) writes nothing when another tenant attached the new account meanwhile', async () => {
      const original = auth.api.signUpEmail;
      let attachedInB: Awaited<ReturnType<ReturnType<typeof moduleFor>['create']>> | undefined;
      const spy = vi.spyOn(auth.api, 'signUpEmail').mockImplementationOnce(async (args) => {
        const res = await original(args as Parameters<typeof original>[0]);
        attachedInB = await moduleFor(b, true).create({
          name: 'Other',
          email: 'mid@test.local',
          role: 'operator',
        });
        return res;
      });
      await expectAppError(
        moduleFor(a).create({ name: 'M', email: 'mid@test.local', role: 'admin' }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      spy.mockRestore();

      expect(attachedInB?.setupUrl).toBeNull();
      const users = await testDb.select().from(user).where(eq(user.email, 'mid@test.local'));
      expect(users).toHaveLength(1);
      const account = users[0]!;
      expect(await memberRows(account.id)).toEqual([{ organizationId: b.id, role: 'operator' }]);
      expect(account.role).toBe('operator');
      expect(account.mustChangePassword).toBe(false);
      expect(await setupTokens(account.id)).toHaveLength(0);
    });

    it('concurrent creates of the same new email in one tenant yield one member row', async () => {
      const input = { name: 'Race', email: 'race@test.local', role: 'member' as const };
      const results = await Promise.allSettled([
        moduleFor(a).create(input),
        moduleFor(a).create(input),
        moduleFor(a).create(input),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const r of results.filter((r) => r.status === 'rejected')) {
        expect(((r as PromiseRejectedResult).reason as { cause: AppError }).cause.code).toBe(
          ErrorCodes.user.ALREADY_EXISTS,
        );
      }
      const users = await testDb.select().from(user).where(eq(user.email, 'race@test.local'));
      expect(users).toHaveLength(1);
      expect(users[0]!.mustChangePassword).toBe(true);
      expect(await memberRows(users[0]!.id)).toHaveLength(1);
      expect(await setupTokens(users[0]!.id)).toHaveLength(1);
    });

    it('concurrent platform-admin adds of an existing account yield one member row', async () => {
      const results = await Promise.allSettled([
        moduleFor(a, true).create({ name: 'B', email: 'only-b@test.local', role: 'member' }),
        moduleFor(a, true).create({ name: 'B', email: 'only-b@test.local', role: 'member' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await memberRows(onlyB)).filter((m) => m.organizationId === a.id)).toHaveLength(1);
    });

    it('concurrent creates of a new email by two tenant admins: one account, one membership', async () => {
      const input = { name: 'Both', email: 'both@test.local', role: 'member' as const };
      const results = await Promise.allSettled([
        moduleFor(a).create(input),
        moduleFor(b).create(input),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((rejected.reason as { cause: AppError }).cause.code).toBe(
        ErrorCodes.user.ALREADY_EXISTS,
      );
      const users = await testDb.select().from(user).where(eq(user.email, 'both@test.local'));
      expect(users).toHaveLength(1);
      expect(await memberRows(users[0]!.id)).toHaveLength(1);
    });

    // More concurrent creates than the postgres-js pool (10 connections): a create that waited
    // for Better Auth's own connection while holding one would exhaust the pool and hang.
    it('many concurrent creates beyond the pool size complete', { timeout: 20_000 }, async () => {
      const distinct = Array.from({ length: 16 }, (_, i) =>
        moduleFor(a).create({ name: `D${i}`, email: `d${i}@test.local`, role: 'member' }),
      );
      const crossTenant = Array.from({ length: 8 }, (_, i) => [
        moduleFor(a).create({ name: `X${i}`, email: `x${i}@test.local`, role: 'member' }),
        moduleFor(b).create({ name: `X${i}`, email: `x${i}@test.local`, role: 'member' }),
      ]).flat();
      const results = await Promise.allSettled([...distinct, ...crossTenant]);

      expect(results.slice(0, 16).every((r) => r.status === 'fulfilled')).toBe(true);
      for (let i = 0; i < 8; i++) {
        const pair = results.slice(16 + i * 2, 18 + i * 2);
        expect(pair.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const users = await testDb
          .select()
          .from(user)
          .where(eq(user.email, `x${i}@test.local`));
        expect(users).toHaveLength(1);
        expect(await memberRows(users[0]!.id)).toHaveLength(1);
      }
    });
  });

  describe('update', () => {
    it('a user of another tenant is NOT_FOUND and unchanged', async () => {
      await expectAppError(
        moduleFor(a).update(onlyB, { name: 'Hacked', role: 'superadmin' }),
        ErrorCodes.user.NOT_FOUND,
      );
      await expectAppError(
        moduleFor(a, true).update(onlyB, { name: 'Hacked', role: 'superadmin' }),
        ErrorCodes.user.NOT_FOUND,
      );
      const row = await userRow(onlyB);
      expect(row?.name).toBe('only-b@test.local');
      expect(row?.role).toBe('operator');
      expect(await memberRows(onlyB)).toEqual([{ organizationId: b.id, role: 'operator' }]);
    });

    it('a nonexistent id is NOT_FOUND', async () => {
      await expectAppError(
        moduleFor(a).update(randomUUID(), { name: 'X', role: 'member' }),
        ErrorCodes.user.NOT_FOUND,
      );
    });

    it('updates name, global role and the tenant member role of a single-tenant user', async () => {
      const res = await moduleFor(a).update(onlyA, { name: 'Renamed', role: 'operator' });
      expect(res.role).toBe('operator');
      expect(res.name).toBe('Renamed');
      const row = await userRow(onlyA);
      expect(row?.name).toBe('Renamed');
      expect(row?.role).toBe('operator');
      expect(await memberRole(onlyA, a.id)).toBe('operator');
    });

    it('rejects any change to a shared user from a tenant admin and changes nothing', async () => {
      await expectAppError(
        moduleFor(a).update(shared, { name: 'Renamed', role: 'admin' }),
        ErrorCodes.user.IN_MULTIPLE_ORGANIZATIONS,
      );
      const row = await userRow(shared);
      expect(row?.name).toBe('shared@test.local');
      expect(row?.role).toBe('admin');
      expect(await memberRole(shared, a.id)).toBe('admin');
      expect(await memberRole(shared, b.id)).toBe('operator');
    });

    it('lets a platform admin update a shared user, touching only this tenant membership', async () => {
      const res = await moduleFor(a, true).update(shared, { name: 'Renamed', role: 'member' });
      expect(res.role).toBe('member');
      expect((await userRow(shared))?.name).toBe('Renamed');
      expect((await userRow(shared))?.role).toBe('member');
      expect(await memberRole(shared, a.id)).toBe('member');
      expect(await memberRole(shared, b.id)).toBe('operator');
    });

    it('rejects changes to a platform admin account from a tenant admin', async () => {
      const pa = (
        await createTestUser({ email: 'pa@test.local', role: 'admin', isPlatformAdmin: true })
      ).id;
      await addMember(pa, a.id, 'admin');
      await expectAppError(
        moduleFor(a).update(pa, { name: 'X', role: 'member' }),
        ErrorCodes.user.IS_PLATFORM_ADMIN,
      );
      expect((await userRow(pa))?.role).toBe('admin');
      await moduleFor(a, true).update(pa, { name: 'X', role: 'member' });
      expect((await userRow(pa))?.role).toBe('member');
    });
  });

  describe('remove', () => {
    it('a user of another tenant is NOT_FOUND and nothing changes', async () => {
      await insertSession(onlyB, b.id);
      await expectAppError(moduleFor(a).remove(onlyB), ErrorCodes.user.NOT_FOUND);
      await expectAppError(moduleFor(a, true).remove(onlyB), ErrorCodes.user.NOT_FOUND);
      expect(await userRow(onlyB)).toBeDefined();
      expect(await memberRows(onlyB)).toHaveLength(1);
      expect(await sessionOrgs(onlyB)).toEqual([b.id]);
    });

    it('rejects removing a shared user for a tenant admin and changes nothing', async () => {
      await insertSession(shared, a.id);
      await expectAppError(moduleFor(a).remove(shared), ErrorCodes.user.IN_MULTIPLE_ORGANIZATIONS);
      expect(await memberRows(shared)).toHaveLength(2);
      expect(await sessionOrgs(shared)).toEqual([a.id]);
    });

    it('a platform admin removes only the membership and this tenant sessions of a shared user', async () => {
      await insertSession(shared, a.id);
      await insertSession(shared, b.id);
      await insertSession(shared, null);
      expect(await moduleFor(a, true).remove(shared)).toEqual({ id: shared });
      expect(await userRow(shared)).toBeDefined();
      expect(await memberRows(shared)).toEqual([{ organizationId: b.id, role: 'operator' }]);
      expect(await sessionOrgs(shared)).toEqual([b.id, null].sort());
    });

    it('deletes the global user when no membership remains', async () => {
      await insertSession(onlyA, a.id);
      expect(await moduleFor(a).remove(onlyA)).toEqual({ id: onlyA });
      expect(await userRow(onlyA)).toBeUndefined();
      expect(await memberRows(onlyA)).toHaveLength(0);
      expect(await sessionOrgs(onlyA)).toEqual([]);
    });

    it('keeps the account of a platform admin when removing its last membership', async () => {
      const pa = (
        await createTestUser({ email: 'pa@test.local', role: 'admin', isPlatformAdmin: true })
      ).id;
      await addMember(pa, a.id, 'admin');
      await insertSession(pa, a.id);
      await insertSession(pa, null);
      expect(await moduleFor(a).remove(pa)).toEqual({ id: pa });
      expect(await userRow(pa)).toBeDefined();
      expect(await memberRows(pa)).toHaveLength(0);
      expect(await sessionOrgs(pa)).toEqual([null]);
    });

    it('keeps the account of a former platform admin with audit rows instead of failing', async () => {
      const former = (await createTestUser({ email: 'former@test.local', role: 'admin' })).id;
      await addMember(former, a.id, 'admin');
      await testDb
        .insert(platformAccessLog)
        .values({ userId: former, tenantId: b.id, path: 'clients.list', type: 'query' });
      expect(await moduleFor(a).remove(former)).toEqual({ id: former });
      expect(await userRow(former)).toBeDefined();
      expect(await memberRows(former)).toHaveLength(0);
      const audit = await testDb
        .select({ userId: platformAccessLog.userId })
        .from(platformAccessLog)
        .where(eq(platformAccessLog.userId, former));
      expect(audit).toHaveLength(1);
    });

    it('removing a member of B from B leaves the A membership and sessions untouched', async () => {
      await insertSession(shared, a.id);
      await moduleFor(b, true).remove(shared);
      expect(await memberRows(shared)).toEqual([{ organizationId: a.id, role: 'admin' }]);
      expect(await sessionOrgs(shared)).toEqual([a.id]);
    });
  });

  describe('regeneratePasswordSetupLink', () => {
    it('a user of another tenant is NOT_FOUND and no token is issued', async () => {
      await expectAppError(
        moduleFor(a).regeneratePasswordSetupLink(onlyB),
        ErrorCodes.user.NOT_FOUND,
      );
      await expectAppError(
        moduleFor(a, true).regeneratePasswordSetupLink(onlyB),
        ErrorCodes.user.NOT_FOUND,
      );
      expect(await setupTokens(onlyB)).toHaveLength(0);
    });

    it('rejects a shared user for a tenant admin; a platform admin may', async () => {
      await expectAppError(
        moduleFor(a).regeneratePasswordSetupLink(shared),
        ErrorCodes.user.IN_MULTIPLE_ORGANIZATIONS,
      );
      expect(await setupTokens(shared)).toHaveLength(0);
      const res = await moduleFor(a, true).regeneratePasswordSetupLink(shared);
      expect(res.setupUrl.startsWith(`${env.WEB_APP_URL}/set-password?token=`)).toBe(true);
      expect(await setupTokens(shared)).toHaveLength(1);
    });

    it('rejects a platform admin account for a tenant admin', async () => {
      const pa = (await createTestUser({ email: 'pa@test.local', isPlatformAdmin: true })).id;
      await addMember(pa, a.id, 'admin');
      await expectAppError(
        moduleFor(a).regeneratePasswordSetupLink(pa),
        ErrorCodes.user.IS_PLATFORM_ADMIN,
      );
      expect(await setupTokens(pa)).toHaveLength(0);
    });

    it('issues a reset link for a single-tenant member', async () => {
      const res = await moduleFor(a).regeneratePasswordSetupLink(onlyA);
      expect(res.reason).toBe('reset');
      expect(res.setupUrl).toMatch(
        new RegExp(`^${env.WEB_APP_URL}/set-password\\?token=[0-9a-f]+&reason=reset$`),
      );
      expect(await setupTokens(onlyA)).toHaveLength(1);
    });
  });
});
