import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CreateRoleInput } from '@repo/schemas';
import { appRouter } from '../../../core/trpc/router';
import type { Context } from '../../../core/trpc/context';
import { ErrorCodes } from '../../../lib/errors';
import {
  addMember,
  addMemberWithGrants,
  createTestTenant,
  createTestUser,
  resetDb,
  testDb,
} from '../../../test/db';

type Tenant = { id: string; slug: string; name: string };

function callerFor(tenant: Tenant, userId: string) {
  const ctx = {
    req: {},
    res: { setHeader: () => undefined },
    session: {
      session: { id: `sess-${userId}`, userId, activeOrganizationId: tenant.id },
      user: { id: userId, role: 'admin', mustChangePassword: false, isPlatformAdmin: false },
    },
    tenant,
  } as unknown as Context;
  return appRouter.createCaller(ctx);
}

async function tenantWith(slug: string) {
  const t = await createTestTenant(slug);
  return { ...t, name: slug } as Tenant;
}

async function ownerIn(tenant: Tenant) {
  const u = await createTestUser();
  await addMember(u.id, tenant.id, 'superadmin');
  return callerFor(tenant, u.id);
}

async function memberWith(
  tenant: Tenant,
  grants: ReadonlyArray<readonly [string, string, 'own' | 'all']>,
) {
  const u = await createTestUser();
  await addMemberWithGrants(u.id, tenant.id, grants);
  return callerFor(tenant, u.id);
}

const input: CreateRoleInput = {
  name: 'Sales',
  permissions: [{ resource: 'quote', action: 'read', scope: 'all' }],
};

let tenant: Tenant;

beforeEach(async () => {
  await resetDb();
  tenant = await tenantWith('roles-router');
});

describe('roles router', () => {
  it('rejects list without role.read', async () => {
    const t = await memberWith(tenant, [['quote', 'read', 'all']]);
    await expect(t.roles.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets the owner list, get, create, update, duplicate and delete', async () => {
    const t = await ownerIn(tenant);
    expect((await t.roles.list()).length).toBeGreaterThan(0);

    const created = await t.roles.create(input);
    expect(created).toMatchObject({ name: 'Sales', version: 1 });
    expect(await t.roles.get({ id: created.id })).toMatchObject({ id: created.id });

    const updated = await t.roles.update({
      id: created.id,
      expectedVersion: 1,
      name: 'Sales 2',
      permissions: input.permissions,
    });
    expect(updated).toMatchObject({ name: 'Sales 2', version: 2 });

    const copy = await t.roles.duplicate({ id: created.id });
    expect(copy.id).not.toBe(created.id);

    await t.roles.delete({ id: copy.id });
    await expect(t.roles.get({ id: copy.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('with role.update but not role.create can update, not create nor duplicate', async () => {
    const owner = await ownerIn(tenant);
    const target = await owner.roles.create(input);
    const t = await memberWith(tenant, [
      ['role', 'read', 'all'],
      ['role', 'update', 'all'],
      ['quote', 'read', 'all'],
    ]);
    await expect(t.roles.create(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(t.roles.duplicate({ id: target.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    await expect(
      t.roles.update({
        id: target.id,
        expectedVersion: 1,
        name: 'Renamed',
        permissions: input.permissions,
      }),
    ).resolves.toMatchObject({ name: 'Renamed' });
  });

  it('with role.read only cannot update nor delete', async () => {
    const owner = await ownerIn(tenant);
    const target = await owner.roles.create(input);
    const t = await memberWith(tenant, [['role', 'read', 'all']]);
    await expect(t.roles.get({ id: target.id })).resolves.toMatchObject({ id: target.id });
    await expect(
      t.roles.update({
        id: target.id,
        expectedVersion: 1,
        name: 'X',
        permissions: input.permissions,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(t.roles.delete({ id: target.id })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("hides another organization's roles from get, update and delete", async () => {
    const other = await tenantWith('roles-router-b');
    const foreign = await (await ownerIn(other)).roles.create(input);
    const t = await ownerIn(tenant);

    await expect(t.roles.get({ id: foreign.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      t.roles.update({
        id: foreign.id,
        expectedVersion: 1,
        name: 'X',
        permissions: input.permissions,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(t.roles.delete({ id: foreign.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(t.roles.duplicate({ id: foreign.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it.each([
    ['user', 'get'],
    ['user', 'set-role'],
    ['user', 'impersonate'],
    ['session', 'revoke'],
  ])('rejects creating or updating a role that grants %s.%s', async (resource, action) => {
    const t = await ownerIn(tenant);
    const permissions = [...input.permissions, { resource, action, scope: 'all' as const }];
    await expect(t.roles.create({ name: 'Platform', permissions })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    const created = await t.roles.create(input);
    await expect(
      t.roles.update({ id: created.id, expectedVersion: 1, name: 'Sales', permissions }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it.each([
    ['quote', 'create'],
    ['event', 'view_reschedules'],
    ['client', 'read'],
  ])(
    'rejects an own scope on %s.%s, which is never filtered by owner',
    async (resource, action) => {
      const t = await ownerIn(tenant);
      await expect(
        t.roles.create({ name: 'Scoped', permissions: [{ resource, action, scope: 'own' }] }),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('roles.validation.permissionScopeUnsupported'),
      });
      await expect(
        t.roles.create({
          name: 'Scoped',
          permissions: [{ resource: 'quote', action: 'read', scope: 'own' }],
        }),
      ).resolves.toMatchObject({ name: 'Scoped' });
    },
  );

  it('accepts the user permissions that tenant procedures check', async () => {
    const t = await ownerIn(tenant);
    const permissions = ['list', 'create', 'update', 'delete', 'set-password'].map((action) => ({
      resource: 'user',
      action,
      scope: 'all' as const,
    }));
    await expect(t.roles.create({ name: 'People', permissions })).resolves.toMatchObject({
      name: 'People',
    });
  });

  it('propagates ROLE_VERSION_CONFLICT on a stale update', async () => {
    const t = await ownerIn(tenant);
    const created = await t.roles.create(input);
    const err = await t.roles
      .update({ id: created.id, expectedVersion: 5, name: 'X', permissions: input.permissions })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'CONFLICT' });
    expect((err as { cause: { code: string } }).cause.code).toBe(ErrorCodes.role.VERSION_CONFLICT);
  });

  it('propagates ROLE_IN_USE with the member count when deleting an assigned role', async () => {
    const t = await ownerIn(tenant);
    const created = await t.roles.create(input);
    const u = await createTestUser();
    await testDb.execute(sql`
      INSERT INTO "member" ("id", "organization_id", "user_id", "role", "role_id", "created_at")
      VALUES (${randomUUID()}, ${tenant.id}, ${u.id}, 'member', ${created.id}, now())
    `);
    const err = await t.roles.delete({ id: created.id }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'CONFLICT' });
    const cause = (err as { cause: { code: string; details?: unknown } }).cause;
    expect(cause.code).toBe(ErrorCodes.role.IN_USE);
    expect(cause.details).toEqual({ memberCount: 1 });
  });
});

describe('roles.assignable', () => {
  const weaker: CreateRoleInput = {
    name: 'Reader',
    permissions: [{ resource: 'quote', action: 'read', scope: 'own' }],
  };
  const wider: CreateRoleInput = {
    name: 'Wide reader',
    permissions: [{ resource: 'quote', action: 'read', scope: 'all' }],
  };
  const stronger: CreateRoleInput = {
    name: 'Editor',
    permissions: [
      { resource: 'quote', action: 'read', scope: 'own' },
      { resource: 'quote', action: 'update', scope: 'own' },
    ],
  };

  it('rejects a caller with neither user.create nor user.update, even with role.read', async () => {
    const t = await memberWith(tenant, [
      ['role', 'read', 'all'],
      ['user', 'list', 'all'],
    ]);
    await expect(t.roles.assignable()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets a caller with user.create but no role.read list only roles within their power', async () => {
    const owner = await ownerIn(tenant);
    const [reader, wide, editor] = await Promise.all([
      owner.roles.create(weaker),
      owner.roles.create(wider),
      owner.roles.create(stronger),
    ]);
    const t = await memberWith(tenant, [
      ['user', 'create', 'all'],
      ['quote', 'read', 'own'],
    ]);

    const roles = await t.roles.assignable();
    const ids = roles.map((r) => r.id);

    expect(ids).toContain(reader.id);
    expect(ids).not.toContain(wide.id);
    expect(ids).not.toContain(editor.id);
    expect(roles.some((r) => r.isOwner)).toBe(false);
    for (const r of roles) expect(Object.keys(r).sort()).toEqual(['id', 'isOwner', 'name']);
  });

  it('lets a caller with only user.update use it', async () => {
    const t = await memberWith(tenant, [['user', 'update', 'all']]);
    await expect(t.roles.assignable()).resolves.toEqual(expect.any(Array));
  });

  it('gives the owner every role of the organization, the owner role included', async () => {
    const owner = await ownerIn(tenant);
    await owner.roles.create(stronger);
    const all = await owner.roles.list();
    const assignable = await owner.roles.assignable();

    expect(assignable.map((r) => r.id).sort()).toEqual(all.map((r) => r.id).sort());
    expect(assignable.some((r) => r.isOwner)).toBe(true);
  });

  it("never returns another organization's roles", async () => {
    const other = await tenantWith('roles-assignable-b');
    const foreignOwner = await ownerIn(other);
    await foreignOwner.roles.create(weaker);
    const foreignIds = (await foreignOwner.roles.list()).map((r) => r.id);

    const t = await ownerIn(tenant);
    const ids = (await t.roles.assignable()).map((r) => r.id);

    expect(ids.length).toBeGreaterThan(0);
    for (const id of foreignIds) expect(ids).not.toContain(id);
  });
});
