import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, like, sql } from 'drizzle-orm';
import { usersListQuerySchema } from '@repo/schemas';
import type { RoleType } from '@repo/guards';
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
import { OWNER_ACCESS, resolveAccess, type ResolvedAccess } from '../../../lib/rbac/access';
import { seedTenantRoles } from '../../../lib/rbac/seedTenantRoles';
import { createUserWithPassword } from '../../../test/authHelpers';
import {
  addMember,
  addMemberWithGrants,
  createTestUser,
  pointMemberAtForeignRole,
  resetDb,
  seedTwoTenants,
  testDb,
  type TestTenant,
} from '../../../test/db';
import { callerFor } from '../../../test/trpcCaller';
import { UsersRepository } from '../users.repository';
import { usersModule } from '../users.module';

const listAll = usersListQuerySchema.parse({});

type Roles = Record<RoleType, string>;

// Owner of the tenant acting from inside it: unrestricted on roles, but not a platform admin, so
// global account changes stay protected.
const OWNER_MEMBER_ACCESS: ResolvedAccess = {
  isOwner: true,
  grants: {},
  roleId: 'owner-role',
  roleName: 'Owner',
  roleVersion: 1,
};

function moduleFor(
  tenant: TestTenant,
  opts: { isPlatformAdmin?: boolean; access?: ResolvedAccess; userId?: string } | boolean = {},
) {
  const o = typeof opts === 'boolean' ? { isPlatformAdmin: opts } : opts;
  const isPlatformAdmin = o.isPlatformAdmin ?? false;
  return usersModule({
    tenantId: tenant.id,
    user: { id: o.userId ?? randomUUID(), isPlatformAdmin },
    access: o.access ?? (isPlatformAdmin ? OWNER_ACCESS : OWNER_MEMBER_ACCESS),
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
    .select({ organizationId: member.organizationId, role: member.role, roleId: member.roleId })
    .from(member)
    .where(eq(member.userId, userId));
}

async function membership(userId: string, tenantId: string) {
  const [row] = await testDb
    .select({ role: member.role, roleId: member.roleId })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, tenantId)));
  return row;
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
  let rolesA: Roles;
  let rolesB: Roles;
  let onlyA: string;
  let onlyB: string;
  let shared: string;
  let superA: string;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    rolesA = await seedTenantRoles(a.id, testDb);
    rolesB = await seedTenantRoles(b.id, testDb);
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

  // An actor whose role holds exactly `grants` (user management plus whatever the test needs).
  async function delegatedActor(
    tenant: TestTenant,
    grants: ReadonlyArray<readonly [string, string, 'own' | 'all']>,
  ) {
    const actor = (await createTestUser()).id;
    await addMemberWithGrants(actor, tenant.id, grants);
    const access = await resolveAccess({ userId: actor, tenantId: tenant.id }, testDb);
    return moduleFor(tenant, { access: access!, userId: actor });
  }

  describe('repository reads', () => {
    it('findPaginated lists only members of the tenant', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      const resA = await repoA.findPaginated(listAll, true);
      expect(resA.items.map((u) => u.id).sort()).toEqual([a.userId, onlyA, shared, superA].sort());

      const repoB = new UsersRepository(testDb, b.id);
      const resB = await repoB.findPaginated(listAll, true);
      expect(resB.items.map((u) => u.id).sort()).toEqual([b.userId, onlyB, shared].sort());
    });

    it('shows the membership role of each tenant for a shared user', async () => {
      const resA = await new UsersRepository(testDb, a.id).findPaginated(listAll, true);
      const resB = await new UsersRepository(testDb, b.id).findPaginated(listAll, true);
      expect(resA.items.find((u) => u.id === shared)?.role).toEqual({
        id: rolesA.admin,
        name: 'Admin',
        isOwner: false,
      });
      expect(resB.items.find((u) => u.id === shared)?.role).toEqual({
        id: rolesB.operator,
        name: 'Operator',
        isOwner: false,
      });
      expect(resA.items.find((u) => u.id === superA)?.role).toEqual({
        id: rolesA.superadmin,
        name: 'Superadmin',
        isOwner: true,
      });
    });

    it('paginated total and search ignore users of other tenants', async () => {
      const res = await new UsersRepository(testDb, a.id).findPaginated(
        usersListQuerySchema.parse({ page: 1, pageSize: 10, search: 'only' }),
        true,
      );
      expect(res.items.map((u) => u.id)).toEqual([onlyA]);
      expect(res.total).toBe(1);

      const all = await new UsersRepository(testDb, a.id).findPaginated(
        usersListQuerySchema.parse({ page: 1, pageSize: 10 }),
        true,
      );
      expect(all.total).toBe(4);
    });

    it('hides members holding the owner role unless owners are included', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      const withoutOwners = await repoA.findPaginated(
        usersListQuerySchema.parse({ page: 1, pageSize: 10 }),
        false,
      );
      expect(withoutOwners.items.map((u) => u.id)).not.toContain(superA);
      expect(withoutOwners.total).toBe(3);

      // Owner in A, plain member in B: visible in B with that role.
      await addMember(superA, b.id, 'member');
      const inB = await new UsersRepository(testDb, b.id).findPaginated(listAll, false);
      expect(inB.items.find((u) => u.id === superA)?.role.name).toBe('Member');
    });

    it('sorts by role name', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      const asc = await repoA.findPaginated(
        usersListQuerySchema.parse({ sortBy: 'role', sortDir: 'asc' }),
        true,
      );
      expect(asc.items.map((u) => u.role.name)).toEqual(['Admin', 'Admin', 'Member', 'Superadmin']);
      const desc = await repoA.findPaginated(
        usersListQuerySchema.parse({ sortBy: 'role', sortDir: 'desc' }),
        true,
      );
      expect(desc.items.map((u) => u.role.name)).toEqual([
        'Superadmin',
        'Member',
        'Admin',
        'Admin',
      ]);
    });

    it('findById does not return users who are only members of another tenant', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.findById(onlyB)).toBeUndefined();
      expect((await repoA.findById(shared))?.id).toBe(shared);
      expect(await repoA.findById(randomUUID())).toBeUndefined();
    });

    it('findRole resolves only roles of the tenant', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect((await repoA.findRole(rolesA.admin))?.id).toBe(rolesA.admin);
      expect(await repoA.findRole(rolesB.admin)).toBeUndefined();
      expect(await repoA.findRole(randomUUID())).toBeUndefined();
    });

    it('countOwners counts owner-role members of the tenant only', async () => {
      expect(await new UsersRepository(testDb, a.id).countOwners()).toBe(1);
      expect(await new UsersRepository(testDb, b.id).countOwners()).toBe(0);
      const ownerB = (await createTestUser()).id;
      await addMember(ownerB, b.id, 'superadmin');
      expect(await new UsersRepository(testDb, b.id).countOwners()).toBe(1);
      expect(await new UsersRepository(testDb, a.id).countOwners()).toBe(1);
      expect(await new UsersRepository(testDb, a.id).countOwners()).toBe(1);
    });

    it('never reads a role of another tenant through a membership', async () => {
      await pointMemberAtForeignRole(onlyA, a.id);
      const repoA = new UsersRepository(testDb, a.id);
      expect((await repoA.findPaginated(listAll, true)).items.map((u) => u.id)).not.toContain(
        onlyA,
      );
      expect(await repoA.findById(onlyA)).toBeUndefined();
      expect(await repoA.findPublicById(onlyA)).toBeUndefined();
      expect(await repoA.countOwners()).toBe(1);
    });

    it('sessionsCount counts only sessions active in the tenant', async () => {
      await insertSession(shared, a.id);
      await insertSession(shared, b.id);
      await insertSession(shared, b.id);
      await insertSession(shared, null);
      const resA = await new UsersRepository(testDb, a.id).findPaginated(listAll, true);
      const resB = await new UsersRepository(testDb, b.id).findPaginated(listAll, true);
      expect(resA.items.find((u) => u.id === shared)?.sessionsCount).toBe(1);
      expect(resB.items.find((u) => u.id === shared)?.sessionsCount).toBe(2);
    });
  });

  describe('repository writes', () => {
    it('updateUser cannot modify a user who is not a member of the tenant', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.updateUser(onlyB, { name: 'Hacked' })).toBeUndefined();
      expect((await userRow(onlyB))?.name).toBe('only-b@test.local');
      expect(await repoA.updateUser(shared, { name: 'Renamed' })).toEqual({ id: shared });
    });

    it('updateMemberRole and removeMembership only touch the tenant membership', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.updateMemberRole(onlyB, rolesA.admin)).toBeUndefined();
      expect(await repoA.removeMembership(onlyB)).toBeUndefined();
      expect(await memberRows(onlyB)).toEqual([
        { organizationId: b.id, role: 'operator', roleId: rolesB.operator },
      ]);
    });

    it('updateMemberRole refuses a role of another tenant and writes both columns', async () => {
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.updateMemberRole(onlyA, rolesB.member)).toBeUndefined();
      expect(await membership(onlyA, a.id)).toEqual({ role: 'admin', roleId: rolesA.admin });
      expect(await repoA.updateMemberRole(onlyA, rolesA.operator)).toBeDefined();
      expect(await membership(onlyA, a.id)).toEqual({ role: 'operator', roleId: rolesA.operator });
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

    it('addMembership stamps the repository tenant with role_id and the legacy role', async () => {
      const orphan = (await createTestUser({ email: 'orphan@test.local' })).id;
      const repoA = new UsersRepository(testDb, a.id);
      expect(await repoA.addMembership(orphan, rolesB.admin)).toBeUndefined();
      expect(await memberRows(orphan)).toEqual([]);
      expect(await repoA.addMembership(orphan, rolesA.admin)).toBeDefined();
      expect(await memberRows(orphan)).toEqual([
        { organizationId: a.id, role: 'admin', roleId: rolesA.admin },
      ]);
    });

    it('addMembership maps the owner role and a custom role to their legacy text', async () => {
      const owner = (await createTestUser()).id;
      const custom = (await createTestUser()).id;
      const repoA = new UsersRepository(testDb, a.id);
      await repoA.addMembership(owner, rolesA.superadmin);
      const [created] = await testDb.execute<{ id: string }>(
        sql`INSERT INTO "role" ("tenant_id", "name") VALUES (${a.id}, 'Ventas') RETURNING id`,
      );
      await repoA.addMembership(custom, created!.id);
      expect(await membership(owner, a.id)).toEqual({
        role: 'superadmin',
        roleId: rolesA.superadmin,
      });
      expect(await membership(custom, a.id)).toEqual({ role: 'member', roleId: created!.id });
    });
  });

  describe('list (service)', () => {
    it('lists only tenant members with their tenant role', async () => {
      const res = await moduleFor(b).list(listAll);
      expect(res.items.map((u) => u.email).sort()).toEqual(
        [(await userRow(b.userId))!.email, 'only-b@test.local', 'shared@test.local'].sort(),
      );
      expect(res.items.find((u) => u.id === shared)?.role).toEqual({
        id: rolesB.operator,
        name: 'Operator',
        isOwner: false,
      });
    });

    it('a non-owner caller does not see owner members; an owner does', async () => {
      const delegated = await delegatedActor(a, [['user', 'list', 'all']]);
      expect((await delegated.list(listAll)).items.map((u) => u.id)).not.toContain(superA);
      expect((await moduleFor(a).list(listAll)).items.map((u) => u.id)).toContain(superA);
      expect((await moduleFor(a, true).list(listAll)).items.map((u) => u.id)).toContain(superA);
    });
  });

  describe('create', () => {
    it('(a) rejects an email that is already a member of the tenant', async () => {
      await expectAppError(
        moduleFor(a).create({ name: 'X', email: 'only-a@test.local', roleId: rolesA.member }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      await expectAppError(
        moduleFor(a).create({ name: 'X', email: 'Only-A@Test.Local', roleId: rolesA.member }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      expect(await memberRows(onlyA)).toEqual([
        { organizationId: a.id, role: 'admin', roleId: rolesA.admin },
      ]);
    });

    it('(b) rejects a tenant admin adding an account of another tenant, changing nothing', async () => {
      const existing = await createUserWithPassword('real@test.local', { role: 'operator' });
      await addMember(existing, b.id, 'operator');
      const hashBefore = await passwordHash(existing);

      await expectAppError(
        moduleFor(a).create({ name: 'Other name', email: 'real@test.local', roleId: rolesA.admin }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      await expectAppError(
        moduleFor(a).create({ name: 'X', email: 'only-b@test.local', roleId: rolesA.admin }),
        ErrorCodes.user.ALREADY_EXISTS,
      );

      expect(await memberRows(existing)).toEqual([
        { organizationId: b.id, role: 'operator', roleId: rolesB.operator },
      ]);
      expect((await memberRows(onlyB)).map((m) => m.organizationId)).toEqual([b.id]);
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
        moduleFor(a).create({ name: 'O', email: 'orphan@test.local', roleId: rolesA.operator }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      expect(await memberRows(orphan)).toHaveLength(0);
    });

    it('(b) a platform admin adds an existing account of another tenant as a member only', async () => {
      const existing = await createUserWithPassword('real@test.local', { role: 'operator' });
      await addMember(existing, b.id, 'operator');
      const hashBefore = await passwordHash(existing);
      expect(hashBefore).toBeTruthy();

      const res = await moduleFor(a, true).create({
        name: 'Other name',
        email: 'real@test.local',
        roleId: rolesA.admin,
      });

      expect(res.setupUrl).toBeNull();
      expect(res.user.id).toBe(existing);
      expect(res.user.role).toEqual({ id: rolesA.admin, name: 'Admin', isOwner: false });
      expect(await membership(existing, a.id)).toEqual({ role: 'admin', roleId: rolesA.admin });
      expect(await membership(existing, b.id)).toEqual({
        role: 'operator',
        roleId: rolesB.operator,
      });
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
        roleId: rolesA.member,
      });
      expect(res.setupUrl).toBeNull();
      expect((await userRow(pending))?.mustChangePassword).toBe(true);
      expect(await setupTokens(pending)).toHaveLength(0);
    });

    it('(b) never rewrites the global role of an attached account', async () => {
      const orphan = (await createTestUser({ email: 'orphan@test.local', role: 'member' })).id;
      const res = await moduleFor(a, true).create({
        name: 'O',
        email: 'orphan@test.local',
        roleId: rolesA.operator,
      });
      expect(res.setupUrl).toBeNull();
      expect((await userRow(orphan))?.role).toBe('member');
      expect(await membership(orphan, a.id)).toEqual({
        role: 'operator',
        roleId: rolesA.operator,
      });

      const pa = (
        await createTestUser({ email: 'pa@test.local', role: 'superadmin', isPlatformAdmin: true })
      ).id;
      await moduleFor(a, true).create({ name: 'P', email: 'pa@test.local', roleId: rolesA.member });
      expect((await userRow(pa))?.role).toBe('superadmin');
      expect(await membership(pa, a.id)).toEqual({ role: 'member', roleId: rolesA.member });
    });

    it('(c) creates a new account with membership and a setup link; user.role stays default', async () => {
      const res = await moduleFor(a).create({
        name: 'New',
        email: 'new@test.local',
        roleId: rolesA.operator,
      });
      expect(res.setupUrl).toMatch(
        new RegExp(`^${env.WEB_APP_URL}/set-password\\?token=[0-9a-f]+&reason=create$`),
      );
      const created = await userRow(res.user.id);
      expect(created?.email).toBe('new@test.local');
      expect(created?.role).toBe('member');
      expect(created?.mustChangePassword).toBe(true);
      expect(await memberRows(res.user.id)).toEqual([
        { organizationId: a.id, role: 'operator', roleId: rolesA.operator },
      ]);
      expect(await setupTokens(res.user.id)).toHaveLength(1);
      expect(res.user.role).toEqual({ id: rolesA.operator, name: 'Operator', isOwner: false });
    });

    it('rejects a role of another tenant as nonexistent and creates no account', async () => {
      await expectAppError(
        moduleFor(a).create({ name: 'F', email: 'foreign@test.local', roleId: rolesB.admin }),
        ErrorCodes.role.NOT_FOUND,
      );
      await expectAppError(
        moduleFor(a, true).create({ name: 'F', email: 'foreign@test.local', roleId: rolesB.admin }),
        ErrorCodes.role.NOT_FOUND,
      );
      expect(await testDb.select().from(user).where(eq(user.email, 'foreign@test.local'))).toEqual(
        [],
      );
      await expectAppError(
        moduleFor(a, true).create({ name: 'B', email: 'only-b@test.local', roleId: rolesB.admin }),
        ErrorCodes.role.NOT_FOUND,
      );
      expect((await memberRows(onlyB)).map((m) => m.organizationId)).toEqual([b.id]);
    });

    it('a non-owner cannot create a member with the owner role or a stronger role', async () => {
      const delegated = await delegatedActor(a, [
        ['user', 'create', 'all'],
        ['client', 'read', 'all'],
      ]);
      await expectAppError(
        delegated.create({ name: 'O', email: 'o@test.local', roleId: rolesA.superadmin }),
        ErrorCodes.role.PRIVILEGE_ESCALATION,
      );
      await expectAppError(
        delegated.create({ name: 'O', email: 'o@test.local', roleId: rolesA.operator }),
        ErrorCodes.role.PRIVILEGE_ESCALATION,
      );
      expect(await testDb.select().from(user).where(eq(user.email, 'o@test.local'))).toEqual([]);
      const res = await delegated.create({
        name: 'M',
        email: 'm@test.local',
        roleId: rolesA.member,
      });
      expect(res.user.role.id).toBe(rolesA.member);
    });

    it('(c) removes the new account when its membership cannot be written', async () => {
      const spy = vi
        .spyOn(UsersRepository.prototype, 'addMembership')
        .mockRejectedValueOnce(new Error('boom'));
      await expect(
        moduleFor(a).create({ name: 'F', email: 'fail@test.local', roleId: rolesA.member }),
      ).rejects.toThrow('boom');
      spy.mockRestore();
      expect(await testDb.select().from(user).where(eq(user.email, 'fail@test.local'))).toEqual([]);

      const retry = await moduleFor(a).create({
        name: 'F',
        email: 'fail@test.local',
        roleId: rolesA.member,
      });
      expect(retry.setupUrl).not.toBeNull();
      expect(await memberRows(retry.user.id)).toEqual([
        { organizationId: a.id, role: 'member', roleId: rolesA.member },
      ]);
    });

    it('(c) does not add a second membership when the account was attached meanwhile', async () => {
      const original = auth.api.signUpEmail;
      const spy = vi.spyOn(auth.api, 'signUpEmail').mockImplementationOnce(async (args) => {
        const res = await original(args as Parameters<typeof original>[0]);
        await addMember(res.user.id, a.id, 'member');
        return res;
      });
      await expectAppError(
        moduleFor(a, true).create({ name: 'M', email: 'mid@test.local', roleId: rolesA.member }),
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
          roleId: rolesB.operator,
        });
        return res;
      });
      await expectAppError(
        moduleFor(a).create({ name: 'M', email: 'mid@test.local', roleId: rolesA.admin }),
        ErrorCodes.user.ALREADY_EXISTS,
      );
      spy.mockRestore();

      expect(attachedInB?.setupUrl).toBeNull();
      const users = await testDb.select().from(user).where(eq(user.email, 'mid@test.local'));
      expect(users).toHaveLength(1);
      const created = users[0]!;
      expect(await memberRows(created.id)).toEqual([
        { organizationId: b.id, role: 'operator', roleId: rolesB.operator },
      ]);
      expect(created.mustChangePassword).toBe(false);
      expect(await setupTokens(created.id)).toHaveLength(0);
    });

    it('concurrent creates of the same new email in one tenant yield one member row', async () => {
      const input = { name: 'Race', email: 'race@test.local', roleId: rolesA.member };
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
        moduleFor(a, true).create({ name: 'B', email: 'only-b@test.local', roleId: rolesA.member }),
        moduleFor(a, true).create({ name: 'B', email: 'only-b@test.local', roleId: rolesA.member }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await memberRows(onlyB)).filter((m) => m.organizationId === a.id)).toHaveLength(1);
    });

    it('concurrent creates of a new email by two tenant admins: one account, one membership', async () => {
      const results = await Promise.allSettled([
        moduleFor(a).create({ name: 'Both', email: 'both@test.local', roleId: rolesA.member }),
        moduleFor(b).create({ name: 'Both', email: 'both@test.local', roleId: rolesB.member }),
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
        moduleFor(a).create({ name: `D${i}`, email: `d${i}@test.local`, roleId: rolesA.member }),
      );
      const crossTenant = Array.from({ length: 8 }, (_, i) => [
        moduleFor(a).create({ name: `X${i}`, email: `x${i}@test.local`, roleId: rolesA.member }),
        moduleFor(b).create({ name: `X${i}`, email: `x${i}@test.local`, roleId: rolesB.member }),
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
        moduleFor(a).update(onlyB, { name: 'Hacked', roleId: rolesA.admin }),
        ErrorCodes.user.NOT_FOUND,
      );
      await expectAppError(
        moduleFor(a, true).update(onlyB, { name: 'Hacked', roleId: rolesA.admin }),
        ErrorCodes.user.NOT_FOUND,
      );
      const row = await userRow(onlyB);
      expect(row?.name).toBe('only-b@test.local');
      expect(await memberRows(onlyB)).toEqual([
        { organizationId: b.id, role: 'operator', roleId: rolesB.operator },
      ]);
    });

    it('a nonexistent id is NOT_FOUND', async () => {
      await expectAppError(
        moduleFor(a).update(randomUUID(), { name: 'X', roleId: rolesA.member }),
        ErrorCodes.user.NOT_FOUND,
      );
    });

    it('updates the name and the membership role, never the global role', async () => {
      const res = await moduleFor(a).update(onlyA, { name: 'Renamed', roleId: rolesA.operator });
      expect(res.role).toEqual({ id: rolesA.operator, name: 'Operator', isOwner: false });
      expect(res.name).toBe('Renamed');
      const row = await userRow(onlyA);
      expect(row?.name).toBe('Renamed');
      expect(row?.role).toBe('admin');
      expect(await membership(onlyA, a.id)).toEqual({ role: 'operator', roleId: rolesA.operator });
    });

    it('a tenant admin changes the role of a shared account only in its organization', async () => {
      const res = await moduleFor(a).update(shared, {
        name: 'shared@test.local',
        roleId: rolesA.member,
      });
      expect(res.role.id).toBe(rolesA.member);
      expect(await membership(shared, a.id)).toEqual({ role: 'member', roleId: rolesA.member });
      expect(await membership(shared, b.id)).toEqual({
        role: 'operator',
        roleId: rolesB.operator,
      });
      expect((await userRow(shared))?.role).toBe('admin');
    });

    it('a tenant admin still cannot rename a shared account, and nothing changes', async () => {
      await expectAppError(
        moduleFor(a).update(shared, { name: 'Renamed', roleId: rolesA.member }),
        ErrorCodes.user.IN_MULTIPLE_ORGANIZATIONS,
      );
      expect((await userRow(shared))?.name).toBe('shared@test.local');
      expect(await membership(shared, a.id)).toEqual({ role: 'admin', roleId: rolesA.admin });
      expect(await membership(shared, b.id)).toEqual({
        role: 'operator',
        roleId: rolesB.operator,
      });
    });

    it('lets a platform admin rename a shared user, touching only this tenant membership', async () => {
      const res = await moduleFor(a, true).update(shared, {
        name: 'Renamed',
        roleId: rolesA.member,
      });
      expect(res.role.id).toBe(rolesA.member);
      expect((await userRow(shared))?.name).toBe('Renamed');
      expect(await membership(shared, a.id)).toEqual({ role: 'member', roleId: rolesA.member });
      expect(await membership(shared, b.id)).toEqual({
        role: 'operator',
        roleId: rolesB.operator,
      });
    });

    it('a tenant admin cannot rename a platform admin account but may change its role here', async () => {
      const pa = (
        await createTestUser({ email: 'pa@test.local', role: 'admin', isPlatformAdmin: true })
      ).id;
      await addMember(pa, a.id, 'admin');
      await expectAppError(
        moduleFor(a).update(pa, { name: 'X', roleId: rolesA.member }),
        ErrorCodes.user.IS_PLATFORM_ADMIN,
      );
      expect((await userRow(pa))?.name).toBe('pa@test.local');
      expect(await membership(pa, a.id)).toEqual({ role: 'admin', roleId: rolesA.admin });
      await moduleFor(a).update(pa, { name: 'pa@test.local', roleId: rolesA.member });
      expect(await membership(pa, a.id)).toEqual({ role: 'member', roleId: rolesA.member });
      await moduleFor(a, true).update(pa, { name: 'X', roleId: rolesA.member });
      expect((await userRow(pa))?.name).toBe('X');
    });

    it('rejects a role of another tenant as nonexistent', async () => {
      await expectAppError(
        moduleFor(a).update(onlyA, { name: 'only-a@test.local', roleId: rolesB.admin }),
        ErrorCodes.role.NOT_FOUND,
      );
      await expectAppError(
        moduleFor(a, true).update(onlyA, { name: 'only-a@test.local', roleId: rolesB.admin }),
        ErrorCodes.role.NOT_FOUND,
      );
      expect(await membership(onlyA, a.id)).toEqual({ role: 'admin', roleId: rolesA.admin });
    });

    describe('assignment by a non-owner', () => {
      const grants = [
        ['user', 'update', 'all'],
        ['client', 'read', 'all'],
        ['client', 'create', 'all'],
        ['client', 'update', 'all'],
        ['client', 'delete', 'all'],
        ['product', 'read', 'all'],
        ['event_type', 'read', 'all'],
        ['staff', 'read', 'all'],
        ['pipeline', 'read', 'all'],
        ['pipeline', 'create', 'all'],
        ['pipeline', 'update', 'all'],
        ['pipeline', 'delete', 'all'],
        ['quote', 'read', 'own'],
        ['quote', 'create', 'own'],
        ['quote', 'update', 'own'],
        ['quote', 'delete', 'own'],
        ['event', 'read', 'own'],
        ['event', 'manage_staff_assignments', 'own'],
        ['event', 'view_reschedules', 'own'],
      ] as const;

      it('cannot assign the owner role', async () => {
        const delegated = await delegatedActor(a, grants);
        await expectAppError(
          delegated.update(onlyA, { name: 'only-a@test.local', roleId: rolesA.superadmin }),
          ErrorCodes.role.PRIVILEGE_ESCALATION,
        );
        expect((await membership(onlyA, a.id))?.roleId).toBe(rolesA.admin);
      });

      it('cannot assign a role holding permissions they lack', async () => {
        const delegated = await delegatedActor(a, grants);
        const target = (await createTestUser()).id;
        await addMember(target, a.id, 'member');
        await expectAppError(
          delegated.update(target, { name: (await userRow(target))!.name, roleId: rolesA.admin }),
          ErrorCodes.role.PRIVILEGE_ESCALATION,
        );
        expect((await membership(target, a.id))?.roleId).toBe(rolesA.member);
        await delegated.update(target, {
          name: (await userRow(target))!.name,
          roleId: rolesA.operator,
        });
        expect(await membership(target, a.id)).toEqual({
          role: 'operator',
          roleId: rolesA.operator,
        });
      });

      it('sees a member holding the owner role as nonexistent: no change, no removal', async () => {
        const delegated = await delegatedActor(a, [...grants, ['user', 'delete', 'all']]);
        await expectAppError(
          delegated.update(superA, { name: 'super-a@test.local', roleId: rolesA.member }),
          ErrorCodes.user.NOT_FOUND,
        );
        await expectAppError(delegated.remove(superA), ErrorCodes.user.NOT_FOUND);
        expect(await membership(superA, a.id)).toEqual({
          role: 'superadmin',
          roleId: rolesA.superadmin,
        });
      });

      it('cannot rename an owner member or a stronger member', async () => {
        const delegated = await delegatedActor(a, grants);
        await expectAppError(
          delegated.update(superA, { name: 'Renamed', roleId: rolesA.superadmin }),
          ErrorCodes.user.NOT_FOUND,
        );
        await expectAppError(
          delegated.update(onlyA, { name: 'Renamed', roleId: rolesA.admin }),
          ErrorCodes.role.PRIVILEGE_ESCALATION,
        );
        expect((await userRow(superA))?.name).toBe('super-a@test.local');
        expect((await userRow(onlyA))?.name).toBe('only-a@test.local');
      });

      it('a no-op update cannot reach an owner member or a stronger member', async () => {
        const delegated = await delegatedActor(a, grants);
        await expectAppError(
          delegated.update(superA, { name: 'super-a@test.local', roleId: rolesA.superadmin }),
          ErrorCodes.user.NOT_FOUND,
        );
        await expectAppError(
          delegated.update(onlyA, { name: 'only-a@test.local', roleId: rolesA.admin }),
          ErrorCodes.role.PRIVILEGE_ESCALATION,
        );
        const res = await moduleFor(a).update(superA, {
          name: 'super-a@test.local',
          roleId: rolesA.superadmin,
        });
        expect(res.id).toBe(superA);
      });

      it('cannot issue a password link for an owner member or a stronger member', async () => {
        const delegated = await delegatedActor(a, [...grants, ['user', 'set-password', 'all']]);
        await expectAppError(
          delegated.regeneratePasswordSetupLink(superA),
          ErrorCodes.user.NOT_FOUND,
        );
        await expectAppError(
          delegated.regeneratePasswordSetupLink(onlyA),
          ErrorCodes.role.PRIVILEGE_ESCALATION,
        );
        expect(await setupTokens(superA)).toHaveLength(0);
        expect(await setupTokens(onlyA)).toHaveLength(0);

        const weaker = (await createTestUser()).id;
        await addMember(weaker, a.id, 'operator');
        await delegated.regeneratePasswordSetupLink(weaker);
        expect(await setupTokens(weaker)).toHaveLength(1);

        await moduleFor(a).regeneratePasswordSetupLink(superA);
        expect(await setupTokens(superA)).toHaveLength(1);
      });
    });

    describe('last owner', () => {
      beforeEach(async () => {
        // The only owner of A also belongs to B: other memberships never make the last owner removable.
        await addMember(superA, b.id, 'member');
      });

      it('changing the role of the last owner fails with ROLE_LAST_OWNER', async () => {
        await expectAppError(
          moduleFor(a).update(superA, { name: 'super-a@test.local', roleId: rolesA.admin }),
          ErrorCodes.role.LAST_OWNER,
        );
        await expectAppError(
          moduleFor(a, true).update(superA, { name: 'super-a@test.local', roleId: rolesA.admin }),
          ErrorCodes.role.LAST_OWNER,
        );
        expect((await membership(superA, a.id))?.roleId).toBe(rolesA.superadmin);
      });

      it('removing the last owner fails with ROLE_LAST_OWNER', async () => {
        await expectAppError(moduleFor(a).remove(superA), ErrorCodes.role.LAST_OWNER);
        await expectAppError(moduleFor(a, true).remove(superA), ErrorCodes.role.LAST_OWNER);
        expect((await membership(superA, a.id))?.roleId).toBe(rolesA.superadmin);
      });

      it('an owner can be demoted or removed once another owner exists', async () => {
        await moduleFor(a).update(onlyA, { name: 'only-a@test.local', roleId: rolesA.superadmin });
        await moduleFor(a).update(superA, { name: 'super-a@test.local', roleId: rolesA.admin });
        expect((await membership(superA, a.id))?.roleId).toBe(rolesA.admin);
        await expectAppError(moduleFor(a).remove(onlyA), ErrorCodes.role.LAST_OWNER);
      });

      it('two owners demoting each other concurrently leave at least one owner', async () => {
        await addMember(onlyB, a.id, 'superadmin');
        const results = await Promise.allSettled([
          moduleFor(a).update(superA, { name: 'super-a@test.local', roleId: rolesA.admin }),
          moduleFor(a).update(onlyB, { name: 'only-b@test.local', roleId: rolesA.admin }),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        expect((rejected.reason as { cause: AppError }).cause.code).toBe(
          ErrorCodes.role.LAST_OWNER,
        );
        expect(await new UsersRepository(testDb, a.id).countOwners()).toBe(1);
      });

      it('two owners removing each other concurrently leave at least one owner', async () => {
        await addMember(onlyB, a.id, 'superadmin');
        const results = await Promise.allSettled([
          moduleFor(a).remove(superA),
          moduleFor(a).remove(onlyB),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        expect((rejected.reason as { cause: AppError }).cause.code).toBe(
          ErrorCodes.role.LAST_OWNER,
        );
        expect(await new UsersRepository(testDb, a.id).countOwners()).toBe(1);
      });
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

    it('a tenant admin removes only its membership of a shared account and keeps the account', async () => {
      await insertSession(shared, a.id);
      await insertSession(shared, b.id);
      await insertSession(shared, null);
      expect(await moduleFor(a).remove(shared)).toEqual({ id: shared });
      expect(await userRow(shared)).toBeDefined();
      expect(await memberRows(shared)).toEqual([
        { organizationId: b.id, role: 'operator', roleId: rolesB.operator },
      ]);
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
      expect(await memberRows(shared)).toEqual([
        { organizationId: a.id, role: 'admin', roleId: rolesA.admin },
      ]);
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

  describe('router', () => {
    it('nobody changes their own role; renaming oneself with the same role is allowed', async () => {
      const caller = callerFor(a, { id: superA });
      await expect(
        caller.users.update({ id: superA, data: { name: 'Me', roleId: rolesA.admin } }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        cause: { code: ErrorCodes.user.CANNOT_EDIT_OWN_ROLE },
      });
      expect((await membership(superA, a.id))?.roleId).toBe(rolesA.superadmin);
      const res = await caller.users.update({
        id: superA,
        data: { name: 'super-a@test.local', roleId: rolesA.superadmin },
      });
      expect(res.role.id).toBe(rolesA.superadmin);
    });

    it('list hides owner members from an admin and shows them to an owner, whatever user.role says', async () => {
      const asAdmin = await callerFor(a, { id: onlyA }).users.list(listAll);
      expect(asAdmin.items.map((u) => u.id)).not.toContain(superA);
      const asOwner = await callerFor(a, { id: superA }).users.list(listAll);
      expect(asOwner.items.map((u) => u.id)).toContain(superA);
    });
  });
});
