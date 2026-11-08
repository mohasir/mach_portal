import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { ROLE_TEMPLATES } from '@repo/guards';
import { role, rolePermission } from '../../../db/schema';
import { createTestTenant, resetDb, testDb } from '../../../test/db';
import { legacyMemberRole, seedTenantRoles } from '../seedTenantRoles';

describe('seedTenantRoles', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('creates the four base roles with a single owner', async () => {
    const t = await createTestTenant('t1');
    const ids = await seedTenantRoles(t.id);
    expect(Object.keys(ids).sort()).toEqual(['admin', 'member', 'operator', 'superadmin']);
    const rows = await testDb.select().from(role).where(eq(role.tenantId, t.id));
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.isOwner).map((r) => r.id)).toEqual([ids.superadmin]);
  });

  it('is idempotent', async () => {
    const t = await createTestTenant('t1');
    const first = await seedTenantRoles(t.id);
    const second = await seedTenantRoles(t.id);
    expect(second).toEqual(first);
    expect(await testDb.select().from(role).where(eq(role.tenantId, t.id))).toHaveLength(4);
  });

  it('stores permission rows equal to ROLE_TEMPLATES', async () => {
    const t = await createTestTenant('t1');
    const ids = await seedTenantRoles(t.id);
    await seedTenantRoles(t.id);
    for (const tpl of ROLE_TEMPLATES) {
      const rows = await testDb
        .select()
        .from(rolePermission)
        .where(and(eq(rolePermission.roleId, ids[tpl.key]), eq(rolePermission.tenantId, t.id)));
      const key = (p: { resource: string; action: string; scope: string }) =>
        `${p.resource}:${p.action}:${p.scope}`;
      expect(rows.map(key).sort()).toEqual(tpl.permissions.map(key).sort());
    }
  });

  it('does not restore a permission the tenant removed', async () => {
    const t = await createTestTenant('t1');
    const ids = await seedTenantRoles(t.id);
    await testDb
      .delete(rolePermission)
      .where(and(eq(rolePermission.roleId, ids.admin), eq(rolePermission.resource, 'client')));
    await seedTenantRoles(t.id);
    const rows = await testDb
      .select()
      .from(rolePermission)
      .where(and(eq(rolePermission.roleId, ids.admin), eq(rolePermission.resource, 'client')));
    expect(rows).toEqual([]);
  });

  it('reuses an owner role that has another name', async () => {
    const t = await createTestTenant('t1');
    const [owner] = await testDb
      .insert(role)
      .values({ tenantId: t.id, name: 'Dueño', isOwner: true })
      .returning({ id: role.id });
    const ids = await seedTenantRoles(t.id);
    expect(ids.superadmin).toBe(owner!.id);
    const rows = await testDb.select().from(role).where(eq(role.tenantId, t.id));
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.isOwner)).toHaveLength(1);
  });

  it('names the tenant and role when a base role name is taken by a non-matching role', async () => {
    const t = await createTestTenant('t1');
    await testDb.insert(role).values({ tenantId: t.id, name: 'Superadmin', isOwner: false });
    await expect(seedTenantRoles(t.id)).rejects.toThrow(
      new RegExp(`"Superadmin" for tenant ${t.id}`),
    );
  });

  it('rolls back partial work when it fails', async () => {
    const t = await createTestTenant('t1');
    await testDb.insert(role).values({ tenantId: t.id, name: 'Superadmin', isOwner: false });
    await seedTenantRoles(t.id).catch(() => undefined);
    expect(await testDb.select().from(role).where(eq(role.tenantId, t.id))).toHaveLength(1);
  });

  it('works inside a transaction', async () => {
    const t = await createTestTenant('t1');
    await testDb.transaction(async (tx) => {
      await seedTenantRoles(t.id, tx);
    });
    expect(await testDb.select().from(role).where(eq(role.tenantId, t.id))).toHaveLength(4);
  });

  it('maps a role key to the legacy member.role text', () => {
    expect(legacyMemberRole('superadmin')).toBe('superadmin');
    expect(legacyMemberRole('operator')).toBe('operator');
  });
});
