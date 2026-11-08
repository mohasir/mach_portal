import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { db } from '../../../db';
import { member, platformAccessLog, role, rolePermission } from '../../../db/schema';
import {
  addMember,
  createTestTenant,
  createTestUser,
  pointMemberAtForeignRole,
  resetDb,
} from '../../../test/db';
import type { Context } from '../../../core/trpc/context';
import { guardedProcedure, protectedProcedure, router } from '../../../core/trpc/trpc';
import { OWNER_ACCESS, permissionsVersion, resolveAccess } from '../access';

const testRouter = router({
  access: protectedProcedure.query(({ ctx }) => ctx.access),
  guarded: guardedProcedure({ [RESOURCES.QUOTE]: [ACTIONS.READ] }).query(() => 'ok'),
});

function ctxFor(
  tenant: { id: string; slug: string },
  u: { id: string },
  opts: { isPlatformAdmin?: boolean; role?: string } = {},
): Context {
  return {
    req: {},
    res: { setHeader: () => undefined },
    session: {
      session: { id: `sess-${u.id}`, userId: u.id, activeOrganizationId: tenant.id },
      user: {
        id: u.id,
        role: opts.role ?? 'member',
        mustChangePassword: false,
        isPlatformAdmin: opts.isPlatformAdmin ?? false,
      },
    },
    tenant: { ...tenant, name: tenant.slug },
  } as unknown as Context;
}

async function roleId(tenantId: string, name: string): Promise<string> {
  const [row] = await db
    .select({ id: role.id })
    .from(role)
    .where(and(eq(role.tenantId, tenantId), eq(role.name, name)));
  return row!.id;
}

describe('resolveAccess', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('resolves different grants for the same user in two organizations', async () => {
    const a = await createTestTenant('tenant-a');
    const b = await createTestTenant('tenant-b');
    const u = await createTestUser({ role: 'superadmin' });
    await addMember(u.id, a.id, 'operator');
    await addMember(u.id, b.id, 'admin');

    const inA = await resolveAccess({ userId: u.id, tenantId: a.id });
    const inB = await resolveAccess({ userId: u.id, tenantId: b.id });

    expect(inA).toMatchObject({
      isOwner: false,
      roleId: await roleId(a.id, 'Operator'),
      roleVersion: 1,
    });
    expect(inB).toMatchObject({ isOwner: false, roleId: await roleId(b.id, 'Admin') });
    expect(inA!.grants['quote.read']).toBe('own');
    expect(inB!.grants['quote.read']).toBe('all');
    expect(inA!.grants['tax_rates.update']).toBeUndefined();
    expect(inB!.grants['tax_rates.update']).toBe('all');
  });

  it('marks the owner role as owner', async () => {
    const a = await createTestTenant('tenant-a');
    const u = await createTestUser();
    await addMember(u.id, a.id, 'superadmin');
    await expect(resolveAccess({ userId: u.id, tenantId: a.id })).resolves.toMatchObject({
      isOwner: true,
      roleId: await roleId(a.id, 'Superadmin'),
    });
  });

  it('sees a role edit on the very next call (no cache)', async () => {
    const a = await createTestTenant('tenant-a');
    const u = await createTestUser();
    await addMember(u.id, a.id, 'operator');
    const operator = await roleId(a.id, 'Operator');
    expect((await resolveAccess({ userId: u.id, tenantId: a.id }))!.grants['quote.read']).toBe(
      'own',
    );

    await db
      .update(rolePermission)
      .set({ scope: 'all' })
      .where(
        and(
          eq(rolePermission.roleId, operator),
          eq(rolePermission.resource, 'quote'),
          eq(rolePermission.action, 'read'),
        ),
      );
    await db
      .delete(rolePermission)
      .where(and(eq(rolePermission.roleId, operator), eq(rolePermission.resource, 'client')));
    await db
      .update(role)
      .set({ version: sql`${role.version} + 1` })
      .where(eq(role.id, operator));

    const after = await resolveAccess({ userId: u.id, tenantId: a.id });
    expect(after!.grants['quote.read']).toBe('all');
    expect(after!.grants['client.read']).toBeUndefined();
    expect(after!.roleVersion).toBe(2);
  });

  it('is null without a membership in that organization', async () => {
    const a = await createTestTenant('tenant-a');
    const b = await createTestTenant('tenant-b');
    const u = await createTestUser();
    await addMember(u.id, b.id, 'admin');
    await expect(resolveAccess({ userId: u.id, tenantId: a.id })).resolves.toBeNull();
  });

  it('cannot meet a member without role_id: the database refuses it', async () => {
    const a = await createTestTenant('tenant-a');
    const u = await createTestUser();
    await addMember(u.id, a.id, 'admin');
    await expect(
      db
        .update(member)
        .set({ roleId: sql`null` })
        .where(eq(member.userId, u.id)),
    ).rejects.toMatchObject({ cause: { code: '23502' } });
  });

  it('is null for a member whose role belongs to another organization, and the request is FORBIDDEN', async () => {
    const a = await createTestTenant('tenant-a');
    const b = await createTestTenant('tenant-b');
    const u = await createTestUser();
    await addMember(u.id, a.id, 'member');
    await addMember((await createTestUser()).id, b.id, 'superadmin');
    const foreignOwner = await roleId(b.id, 'Superadmin');
    await db.update(member).set({ roleId: foreignOwner }).where(eq(member.userId, u.id));

    await expect(resolveAccess({ userId: u.id, tenantId: a.id })).resolves.toBeNull();
    await expect(testRouter.createCaller(ctxFor(a, u)).access()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('ignores permission rows outside the catalog', async () => {
    const a = await createTestTenant('tenant-a');
    const u = await createTestUser();
    await addMember(u.id, a.id, 'member');
    const memberRole = await roleId(a.id, 'Member');
    await db.insert(rolePermission).values([
      { roleId: memberRole, tenantId: a.id, resource: 'ghost', action: 'read', scope: 'all' },
      { roleId: memberRole, tenantId: a.id, resource: 'quote', action: 'nope', scope: 'all' },
      { roleId: memberRole, tenantId: a.id, resource: 'quote', action: 'read', scope: 'own' },
    ]);
    const access = await resolveAccess({ userId: u.id, tenantId: a.id });
    expect(access!.grants).toEqual({ 'quote.read': 'own' });
  });

  it('ignores permission rows stamped with another tenant', async () => {
    const a = await createTestTenant('tenant-a');
    const b = await createTestTenant('tenant-b');
    const u = await createTestUser();
    await addMember(u.id, a.id, 'member');
    await addMember((await createTestUser()).id, b.id, 'member');
    await db.insert(rolePermission).values({
      roleId: await roleId(a.id, 'Member'),
      tenantId: b.id,
      resource: 'quote',
      action: 'read',
      scope: 'all',
    });
    const access = await resolveAccess({ userId: u.id, tenantId: a.id });
    expect(access!.grants).toEqual({});
  });

  it('formats the permissions version', async () => {
    expect(permissionsVersion(OWNER_ACCESS)).toBe('owner:0');
    const id = randomUUID();
    expect(
      permissionsVersion({ isOwner: false, grants: {}, roleId: id, roleName: 'X', roleVersion: 3 }),
    ).toBe(`${id}:3`);
  });
});

describe('platform admin access', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('a platform admin who is a member uses the membership role and writes no audit row', async () => {
    const a = await createTestTenant('tenant-a');
    const p = await createTestUser({ isPlatformAdmin: true, role: 'superadmin' });
    await addMember(p.id, a.id, 'member');
    const ctx = ctxFor(a, p, { isPlatformAdmin: true, role: 'superadmin' });

    await expect(testRouter.createCaller(ctx).access()).resolves.toMatchObject({
      isOwner: false,
      roleId: await roleId(a.id, 'Member'),
    });
    await expect(testRouter.createCaller(ctx).guarded()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(await db.select().from(platformAccessLog)).toHaveLength(0);
  });

  it('a platform admin without membership gets OWNER_ACCESS and an audit row', async () => {
    const a = await createTestTenant('tenant-a');
    const p = await createTestUser({ isPlatformAdmin: true, role: 'user' });
    const ctx = ctxFor(a, p, { isPlatformAdmin: true, role: 'user' });

    await expect(testRouter.createCaller(ctx).access()).resolves.toEqual(OWNER_ACCESS);
    await expect(testRouter.createCaller(ctx).guarded()).resolves.toBe('ok');
    const rows = await db.select().from(platformAccessLog);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: p.id, tenantId: a.id });
  });

  it('a platform admin member whose role is broken is FORBIDDEN, not promoted to owner', async () => {
    const a = await createTestTenant('tenant-a');
    const p = await createTestUser({ isPlatformAdmin: true });
    await addMember(p.id, a.id, 'admin');
    await pointMemberAtForeignRole(p.id, a.id);
    await expect(
      testRouter.createCaller(ctxFor(a, p, { isPlatformAdmin: true })).access(),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.select().from(platformAccessLog)).toHaveLength(0);
  });
});
