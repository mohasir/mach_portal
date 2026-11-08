import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { and, asc, eq, sql } from 'drizzle-orm';
import { createRoleSchema, updateRoleSchema, type CreateRoleInput } from '@repo/schemas';
import type { TenantCtx } from '../../../core/trpc/tenantCtx';
import { role, roleAuditLog, rolePermission } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { OWNER_ACCESS, resolveAccess } from '../../../lib/rbac/access';
import {
  addMember,
  addMemberWithGrants,
  createTestTenant,
  createTestUser,
  resetDb,
  testDb,
} from '../../../test/db';
import { rolesModule } from '../roles.module';

type Tenant = { id: string; slug: string };

async function ctxFor(tenantId: string, userId: string): Promise<TenantCtx> {
  const access = await resolveAccess({ userId, tenantId });
  if (!access) throw new Error('test user has no access in tenant');
  return { tenantId, user: { id: userId }, session: {}, access } as unknown as TenantCtx;
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected a rejection, got success');
    },
    (e: unknown) => e,
  );
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  const err = await caught(promise);
  const cause = (err as { cause?: unknown }).cause;
  expect(cause).toBeInstanceOf(AppError);
  expect((cause as AppError).code).toBe(code);
  return cause as AppError;
}

async function roleRow(id: string) {
  const [row] = await testDb.select().from(role).where(eq(role.id, id));
  return row;
}

async function permissionRows(roleId: string) {
  return testDb
    .select({
      resource: rolePermission.resource,
      action: rolePermission.action,
      scope: rolePermission.scope,
      tenantId: rolePermission.tenantId,
    })
    .from(rolePermission)
    .where(eq(rolePermission.roleId, roleId))
    .orderBy(asc(rolePermission.resource), asc(rolePermission.action));
}

async function auditRows(tenantId: string) {
  return testDb
    .select()
    .from(roleAuditLog)
    .where(eq(roleAuditLog.tenantId, tenantId))
    .orderBy(asc(roleAuditLog.createdAt));
}

async function addMemberToRole(tenantId: string, roleId: string) {
  const user = await createTestUser();
  await testDb.execute(sql`
    INSERT INTO "member" ("id", "organization_id", "user_id", "role", "role_id", "created_at")
    VALUES (${randomUUID()}, ${tenantId}, ${user.id}, 'member', ${roleId}, now())
  `);
  return user.id;
}

const salesInput: CreateRoleInput = {
  name: 'Sales',
  permissions: [
    { resource: 'quote', action: 'read', scope: 'own' },
    { resource: 'quote', action: 'update', scope: 'own' },
  ],
};

let tenant: Tenant;
let ownerCtx: TenantCtx;
let ownerId: string;

beforeEach(async () => {
  await resetDb();
  tenant = await createTestTenant('roles-t');
  const owner = await createTestUser();
  ownerId = owner.id;
  await addMember(owner.id, tenant.id, 'superadmin');
  ownerCtx = await ctxFor(tenant.id, owner.id);
});

describe('roles service', () => {
  it('creates a role and lists every tenant role with its member count', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    expect(created).toMatchObject({ name: 'Sales', isOwner: false, version: 1, memberCount: 0 });
    expect(created.permissions).toEqual([
      { resource: 'quote', action: 'read', scope: 'own' },
      { resource: 'quote', action: 'update', scope: 'own' },
    ]);
    expect(await permissionRows(created.id)).toEqual([
      { resource: 'quote', action: 'read', scope: 'own', tenantId: tenant.id },
      { resource: 'quote', action: 'update', scope: 'own', tenantId: tenant.id },
    ]);

    await addMemberToRole(tenant.id, created.id);
    await addMemberToRole(tenant.id, created.id);

    const list = await rolesModule(ownerCtx).list();
    const byName = Object.fromEntries(list.map((r) => [r.name, r]));
    expect(Object.keys(byName).sort()).toEqual([
      'Admin',
      'Member',
      'Operator',
      'Sales',
      'Superadmin',
    ]);
    expect(byName.Sales!.memberCount).toBe(2);
    expect(byName.Superadmin).toMatchObject({ isOwner: true, memberCount: 1 });
    expect(byName.Admin!.memberCount).toBe(0);
  });

  it('gets a role with its permissions', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    const fetched = await rolesModule(ownerCtx).get(created.id);
    expect(fetched).toMatchObject({ id: created.id, name: 'Sales', version: 1, memberCount: 0 });
    expect(fetched.permissions).toHaveLength(2);
  });

  it('get of an unknown id is ROLE_NOT_FOUND', async () => {
    await expectAppError(rolesModule(ownerCtx).get(randomUUID()), ErrorCodes.role.NOT_FOUND);
  });

  it('updates name and permissions, bumping the version', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    const updated = await rolesModule(ownerCtx).update(created.id, {
      expectedVersion: 1,
      name: 'Sales team',
      permissions: [{ resource: 'client', action: 'read', scope: 'all' }],
    });
    expect(updated).toMatchObject({ name: 'Sales team', version: 2 });
    expect(await permissionRows(created.id)).toEqual([
      { resource: 'client', action: 'read', scope: 'all', tenantId: tenant.id },
    ]);
  });

  it('update with a stale version is ROLE_VERSION_CONFLICT and changes nothing', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    await rolesModule(ownerCtx).update(created.id, { ...salesInput, expectedVersion: 1 });

    await expectAppError(
      rolesModule(ownerCtx).update(created.id, {
        expectedVersion: 1,
        name: 'Stale',
        permissions: [],
      }),
      'ROLE_VERSION_CONFLICT',
    );
    expect(await roleRow(created.id)).toMatchObject({ name: 'Sales', version: 2 });
    expect(await permissionRows(created.id)).toHaveLength(2);
  });

  it('two concurrent updates with the same version: exactly one wins', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    const results = await Promise.allSettled([
      rolesModule(ownerCtx).update(created.id, {
        expectedVersion: 1,
        name: 'First',
        permissions: [{ resource: 'client', action: 'read', scope: 'all' }],
      }),
      rolesModule(ownerCtx).update(created.id, {
        expectedVersion: 1,
        name: 'Second',
        permissions: [{ resource: 'staff', action: 'read', scope: 'all' }],
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const reason = (rejected[0] as PromiseRejectedResult).reason as { cause?: AppError };
    expect(reason.cause?.code).toBe('ROLE_VERSION_CONFLICT');

    const winner = (fulfilled[0] as PromiseFulfilledResult<{ name: string }>).value.name;
    const row = await roleRow(created.id);
    expect(row).toMatchObject({ name: winner, version: 2 });
    const perms = await permissionRows(created.id);
    expect(perms).toHaveLength(1);
    expect(perms[0]!.resource).toBe(winner === 'First' ? 'client' : 'staff');
    expect((await auditRows(tenant.id)).filter((r) => r.action === 'update')).toHaveLength(1);
  });

  it('the owner role cannot be edited or deleted', async () => {
    const [owner] = await testDb
      .select()
      .from(role)
      .where(and(eq(role.tenantId, tenant.id), eq(role.isOwner, true)));

    await expectAppError(
      rolesModule(ownerCtx).update(owner!.id, {
        expectedVersion: owner!.version,
        name: 'Boss',
        permissions: [],
      }),
      ErrorCodes.role.IS_OWNER,
    );
    await expectAppError(rolesModule(ownerCtx).delete(owner!.id), ErrorCodes.role.IS_OWNER);
    await expectAppError(rolesModule(ownerCtx).duplicate(owner!.id), ErrorCodes.role.IS_OWNER);
    expect(await roleRow(owner!.id)).toMatchObject({ name: owner!.name, version: owner!.version });
  });

  it('deleting a role with members is ROLE_IN_USE and reports how many', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    await addMemberToRole(tenant.id, created.id);
    await addMemberToRole(tenant.id, created.id);

    const cause = await expectAppError(
      rolesModule(ownerCtx).delete(created.id),
      ErrorCodes.role.IN_USE,
    );
    expect(cause.details).toEqual({ memberCount: 2 });
    expect(await roleRow(created.id)).toBeDefined();
  });

  it('deletes a role without members together with its permissions', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    await rolesModule(ownerCtx).delete(created.id);
    expect(await roleRow(created.id)).toBeUndefined();
    expect(await permissionRows(created.id)).toEqual([]);
  });

  it('a repeated name is ROLE_NAME_TAKEN on create and update', async () => {
    await expectAppError(
      rolesModule(ownerCtx).create({ name: 'Admin', permissions: [] }),
      ErrorCodes.role.NAME_TAKEN,
    );
    const created = await rolesModule(ownerCtx).create(salesInput);
    await expectAppError(
      rolesModule(ownerCtx).update(created.id, {
        expectedVersion: 1,
        name: 'Operator',
        permissions: [],
      }),
      ErrorCodes.role.NAME_TAKEN,
    );
    expect(await roleRow(created.id)).toMatchObject({ name: 'Sales', version: 1 });
  });

  it('duplicates a role with its permissions and resolves name collisions', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    const first = await rolesModule(ownerCtx).duplicate(created.id);
    const second = await rolesModule(ownerCtx).duplicate(created.id);

    expect(first).toMatchObject({ name: 'Sales (copy)', version: 1, isOwner: false });
    expect(second.name).toBe('Sales (copy 2)');
    expect(
      (await permissionRows(first.id)).map(({ resource, action, scope }) => ({
        resource,
        action,
        scope,
      })),
    ).toEqual(salesInput.permissions);
    expect(await roleRow(created.id)).toMatchObject({ version: 1 });
  });

  it('every mutation leaves an audit row with actor, before and after', async () => {
    const created = await rolesModule(ownerCtx).create(salesInput);
    await rolesModule(ownerCtx).update(created.id, {
      expectedVersion: 1,
      name: 'Sales team',
      permissions: [{ resource: 'client', action: 'read', scope: 'all' }],
    });
    const copy = await rolesModule(ownerCtx).duplicate(created.id);
    await rolesModule(ownerCtx).delete(copy.id);

    const rows = await auditRows(tenant.id);
    expect(rows.map((r) => r.action)).toEqual(['create', 'update', 'duplicate', 'delete']);
    for (const row of rows) {
      expect(row.actorUserId).toBe(ownerId);
      expect(row.tenantId).toBe(tenant.id);
    }

    const [create, update, duplicate, del] = rows;
    expect(create!.before).toBeNull();
    expect(create!.after).toMatchObject({ id: created.id, name: 'Sales', version: 1 });
    expect(create!.roleId).toBe(created.id);

    expect(update!.before).toMatchObject({
      name: 'Sales',
      version: 1,
      permissions: salesInput.permissions,
    });
    expect(update!.after).toMatchObject({
      name: 'Sales team',
      version: 2,
      permissions: [{ resource: 'client', action: 'read', scope: 'all' }],
    });

    expect(duplicate!.before).toMatchObject({ id: created.id, name: 'Sales team' });
    expect(duplicate!.after).toMatchObject({ id: copy.id, name: 'Sales team (copy)' });

    expect(del!.before).toMatchObject({ id: copy.id, name: 'Sales team (copy)' });
    expect(del!.after).toBeNull();
  });

  it('a failed mutation leaves no audit row', async () => {
    await expectAppError(
      rolesModule(ownerCtx).create({ name: 'Admin', permissions: [] }),
      ErrorCodes.role.NAME_TAKEN,
    );
    expect(await auditRows(tenant.id)).toEqual([]);
  });

  describe('privilege escalation', () => {
    let actorCtx: TenantCtx;
    let actorRoleId: string;

    beforeEach(async () => {
      const actor = await createTestUser();
      actorRoleId = await addMemberWithGrants(actor.id, tenant.id, [
        ['quote', 'read', 'all'],
        ['quote', 'update', 'own'],
        ['role', 'create', 'all'],
        ['role', 'update', 'all'],
      ]);
      actorCtx = await ctxFor(tenant.id, actor.id);
    });

    it('a non-owner can grant what they hold, at a scope no wider than theirs', async () => {
      const created = await rolesModule(actorCtx).create({
        name: 'Readers',
        permissions: [
          { resource: 'quote', action: 'read', scope: 'own' },
          { resource: 'quote', action: 'update', scope: 'own' },
        ],
      });
      expect(created.permissions).toHaveLength(2);
    });

    it('cannot grant a permission they lack', async () => {
      await expectAppError(
        rolesModule(actorCtx).create({
          name: 'Deleters',
          permissions: [{ resource: 'quote', action: 'delete', scope: 'all' }],
        }),
        ErrorCodes.role.PRIVILEGE_ESCALATION,
      );
      expect(await auditRows(tenant.id)).toEqual([]);
    });

    it('cannot widen a scope from own to all', async () => {
      await expectAppError(
        rolesModule(actorCtx).create({
          name: 'Wide',
          permissions: [{ resource: 'quote', action: 'update', scope: 'all' }],
        }),
        ErrorCodes.role.PRIVILEGE_ESCALATION,
      );
    });

    it('cannot broaden their own role', async () => {
      const before = await roleRow(actorRoleId);
      await expectAppError(
        rolesModule(actorCtx).update(actorRoleId, {
          expectedVersion: before!.version,
          name: before!.name,
          permissions: [
            { resource: 'quote', action: 'read', scope: 'all' },
            { resource: 'quote', action: 'update', scope: 'own' },
            { resource: 'role', action: 'create', scope: 'all' },
            { resource: 'role', action: 'update', scope: 'all' },
            { resource: 'quote', action: 'delete', scope: 'all' },
          ],
        }),
        ErrorCodes.role.PRIVILEGE_ESCALATION,
      );
      expect(await roleRow(actorRoleId)).toMatchObject({ version: before!.version });
      expect(await permissionRows(actorRoleId)).toHaveLength(4);
    });

    it('cannot change a role that holds permissions they lack, not even to remove them', async () => {
      const stronger = await rolesModule(ownerCtx).create({
        name: 'Stronger',
        permissions: [
          { resource: 'quote', action: 'read', scope: 'all' },
          { resource: 'quote', action: 'delete', scope: 'all' },
        ],
      });
      await expectAppError(
        rolesModule(actorCtx).update(stronger.id, {
          expectedVersion: 1,
          name: 'Stronger',
          permissions: [{ resource: 'quote', action: 'read', scope: 'all' }],
        }),
        ErrorCodes.role.PRIVILEGE_ESCALATION,
      );
      await expectAppError(
        rolesModule(actorCtx).delete(stronger.id),
        ErrorCodes.role.PRIVILEGE_ESCALATION,
      );
      await expectAppError(
        rolesModule(actorCtx).duplicate(stronger.id),
        ErrorCodes.role.PRIVILEGE_ESCALATION,
      );
      expect(await permissionRows(stronger.id)).toHaveLength(2);
      expect(await roleRow(stronger.id)).toMatchObject({ version: 1 });
    });

    it('the owner has no escalation limit', async () => {
      const created = await rolesModule(ownerCtx).create({
        name: 'Everything',
        permissions: [
          { resource: 'quote', action: 'delete', scope: 'all' },
          { resource: 'role', action: 'delete', scope: 'all' },
        ],
      });
      expect(created.permissions).toHaveLength(2);
    });

    it('a platform admin acting as owner has no escalation limit', async () => {
      const platformCtx = {
        tenantId: tenant.id,
        user: { id: randomUUID() },
        session: {},
        access: OWNER_ACCESS,
      } as unknown as TenantCtx;
      const created = await rolesModule(platformCtx).create({
        name: 'Platform made',
        permissions: [{ resource: 'quote', action: 'delete', scope: 'all' }],
      });
      expect(created.permissions).toHaveLength(1);
    });
  });
});

describe('role schemas', () => {
  it('rejects a permission outside the catalog', () => {
    expect(
      createRoleSchema.safeParse({
        name: 'X',
        permissions: [{ resource: 'quote', action: 'launch', scope: 'all' }],
      }).success,
    ).toBe(false);
    expect(
      createRoleSchema.safeParse({
        name: 'X',
        permissions: [{ resource: 'nope', action: 'read', scope: 'all' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a repeated permission and an unknown scope', () => {
    expect(
      createRoleSchema.safeParse({
        name: 'X',
        permissions: [
          { resource: 'quote', action: 'read', scope: 'all' },
          { resource: 'quote', action: 'read', scope: 'own' },
        ],
      }).success,
    ).toBe(false);
    expect(
      createRoleSchema.safeParse({
        name: 'X',
        permissions: [{ resource: 'quote', action: 'read', scope: 'some' }],
      }).success,
    ).toBe(false);
  });

  it('trims the name and bounds it to 1..60 characters', () => {
    expect(createRoleSchema.parse({ name: '  Sales  ', permissions: [] }).name).toBe('Sales');
    expect(createRoleSchema.safeParse({ name: '   ', permissions: [] }).success).toBe(false);
    expect(createRoleSchema.safeParse({ name: 'a'.repeat(61), permissions: [] }).success).toBe(
      false,
    );
  });

  it('update requires the id and the expected version', () => {
    expect(updateRoleSchema.safeParse({ name: 'X', permissions: [] }).success).toBe(false);
    expect(
      updateRoleSchema.safeParse({ id: 'r1', expectedVersion: 1, name: 'X', permissions: [] })
        .success,
    ).toBe(true);
  });
});
