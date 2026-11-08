import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { asc, eq, sql } from 'drizzle-orm';
import type { TenantCtx } from '../../../core/trpc/tenantCtx';
import { role, roleAuditLog, rolePermission } from '../../../db/schema';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { resolveAccess } from '../../../lib/rbac/access';
import {
  addMember,
  createTestUser,
  resetDb,
  seedTwoTenants,
  testDb,
  type TestTenant,
} from '../../../test/db';
import { RolesRepository } from '../roles.repository';
import { rolesModule } from '../roles.module';

async function ownerCtx(tenant: TestTenant): Promise<TenantCtx> {
  const owner = await createTestUser();
  await addMember(owner.id, tenant.id, 'superadmin');
  const access = await resolveAccess({ userId: owner.id, tenantId: tenant.id });
  return {
    tenantId: tenant.id,
    user: { id: owner.id },
    session: {},
    access,
  } as unknown as TenantCtx;
}

async function expectNotFound(promise: Promise<unknown>) {
  const err = await promise.then(
    () => {
      throw new Error('expected ROLE_NOT_FOUND, got success');
    },
    (e: unknown) => e,
  );
  const cause = (err as { cause?: unknown }).cause;
  expect(cause).toBeInstanceOf(AppError);
  expect((cause as AppError).code).toBe(ErrorCodes.role.NOT_FOUND);
}

async function snapshot(tenantId: string) {
  const roles = await testDb
    .select()
    .from(role)
    .where(eq(role.tenantId, tenantId))
    .orderBy(asc(role.id));
  const permissions = await testDb
    .select()
    .from(rolePermission)
    .where(eq(rolePermission.tenantId, tenantId))
    .orderBy(asc(rolePermission.roleId), asc(rolePermission.resource), asc(rolePermission.action));
  const audit = await testDb.select().from(roleAuditLog).where(eq(roleAuditLog.tenantId, tenantId));
  return { roles, permissions, audit };
}

let a: TestTenant;
let b: TestTenant;
let ctxA: TenantCtx;
let roleB: { id: string; version: number };

beforeEach(async () => {
  await resetDb();
  ({ a, b } = await seedTwoTenants());
  ctxA = await ownerCtx(a);
  const ctxB = await ownerCtx(b);
  const created = await rolesModule(ctxB).create({
    name: 'Only in B',
    permissions: [{ resource: 'quote', action: 'read', scope: 'all' }],
  });
  roleB = { id: created.id, version: created.version };
});

describe('roles isolation', () => {
  it('list only returns roles of the active tenant', async () => {
    const list = await rolesModule(ctxA).list();
    expect(list.map((r) => r.id)).not.toContain(roleB.id);
    expect(list.map((r) => r.name)).not.toContain('Only in B');
    expect(list).toHaveLength(4);
  });

  it('member counts ignore members of other tenants', async () => {
    const [ownA] = (await rolesModule(ctxA).list()).filter((r) => r.name === 'Operator');
    const foreign = await createTestUser();
    // Corrupt state on purpose: a B membership pointing at A's role must not count for A.
    await testDb.execute(sql`
      INSERT INTO "member" ("id", "organization_id", "user_id", "role", "role_id", "created_at")
      VALUES (${randomUUID()}, ${b.id}, ${foreign.id}, 'member', ${ownA!.id}, now())
    `);
    const [after] = (await rolesModule(ctxA).list()).filter((r) => r.name === 'Operator');
    expect(after!.memberCount).toBe(0);
    expect((await rolesModule(ctxA).get(ownA!.id)).memberCount).toBe(0);
    const updated = await rolesModule(ctxA).update(ownA!.id, {
      expectedVersion: ownA!.version,
      name: 'Operator',
      permissions: [],
    });
    expect(updated.memberCount).toBe(0);
  });

  it('get, update, delete and duplicate of a role of B behave as nonexistent from A', async () => {
    const beforeB = await snapshot(b.id);
    const beforeA = await snapshot(a.id);

    await expectNotFound(rolesModule(ctxA).get(roleB.id));
    await expectNotFound(
      rolesModule(ctxA).update(roleB.id, {
        expectedVersion: roleB.version,
        name: 'Hijacked',
        permissions: [{ resource: 'quote', action: 'delete', scope: 'all' }],
      }),
    );
    await expectNotFound(rolesModule(ctxA).delete(roleB.id));
    await expectNotFound(rolesModule(ctxA).duplicate(roleB.id));

    expect(await snapshot(b.id)).toEqual(beforeB);
    expect(await snapshot(a.id)).toEqual(beforeA);
  });

  it('a role of B with members is still NOT_FOUND from A, never IN_USE', async () => {
    const user = await createTestUser();
    await testDb.execute(sql`
      INSERT INTO "member" ("id", "organization_id", "user_id", "role", "role_id", "created_at")
      VALUES (${randomUUID()}, ${b.id}, ${user.id}, 'member', ${roleB.id}, now())
    `);
    await expectNotFound(rolesModule(ctxA).delete(roleB.id));
  });

  it('A can reuse a name that exists in B', async () => {
    const created = await rolesModule(ctxA).create({ name: 'Only in B', permissions: [] });
    expect(created.name).toBe('Only in B');
  });

  it('every repository method scoped to A ignores a role of B', async () => {
    const user = await createTestUser();
    await testDb.execute(sql`
      INSERT INTO "member" ("id", "organization_id", "user_id", "role", "role_id", "created_at")
      VALUES (${randomUUID()}, ${b.id}, ${user.id}, 'member', ${roleB.id}, now())
    `);
    const beforeB = await snapshot(b.id);
    const repoA = new RolesRepository(testDb, a.id);

    expect(await repoA.findSummaryById(roleB.id)).toBeUndefined();
    expect(await repoA.inTransaction((repo) => repo.findByIdForUpdate(roleB.id))).toBeUndefined();
    expect(await repoA.findPermissions(roleB.id)).toEqual([]);
    expect(await repoA.countMembers(roleB.id)).toBe(0);
    expect(await repoA.findNames()).not.toContain('Only in B');
    expect(
      await repoA.updateVersioned(roleB.id, roleB.version, { name: 'Hijacked' }),
    ).toBeUndefined();
    await repoA.replacePermissions(roleB.id, []);
    expect(await repoA.deleteById(roleB.id)).toBeUndefined();

    expect(await snapshot(b.id)).toEqual(beforeB);
  });
});
