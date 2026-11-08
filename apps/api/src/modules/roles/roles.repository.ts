import { and, asc, count, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { Executor } from '../../db';
import { member, role, roleAuditLog, rolePermission } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import {
  publicRoleColumns,
  rolePermissionColumns,
  type RoleAuditSnapshot,
  type RolePermissionRow,
} from './roles.resource';

export type RoleAuditAction = 'create' | 'update' | 'duplicate' | 'delete';

export class RolesRepository {
  constructor(
    private db: Executor,
    private tenantId: string,
  ) {}

  inTransaction<T>(fn: (repo: RolesRepository) => Promise<T>): Promise<T> {
    return this.db.transaction((tx) => fn(new RolesRepository(tx, this.tenantId)));
  }

  // `member` has no tenant_id column: organization_id plays that role in the join filter.
  private summaries(where?: SQL) {
    return this.db
      .select({ ...publicRoleColumns, memberCount: count(member.id) })
      .from(role)
      .leftJoin(member, and(eq(member.roleId, role.id), eq(member.organizationId, this.tenantId)))
      .where(and(tenantEq(role, this.tenantId), where))
      .groupBy(role.id);
  }

  listSummaries() {
    return this.summaries().orderBy(desc(role.isOwner), asc(role.name));
  }

  listOptions() {
    return this.db
      .select({ id: role.id, name: role.name, isOwner: role.isOwner })
      .from(role)
      .where(tenantEq(role, this.tenantId))
      .orderBy(desc(role.isOwner), asc(role.name));
  }

  findAllPermissions() {
    return this.db
      .select({ roleId: rolePermission.roleId, ...rolePermissionColumns })
      .from(rolePermission)
      .where(tenantEq(rolePermission, this.tenantId));
  }

  findSummaryById(id: string) {
    return this.summaries(eq(role.id, id)).then((r) => r[0]);
  }

  // Row lock held until the transaction ends: serializes concurrent edits, duplicates and deletes
  // of the same role, so a version check made after it cannot be overtaken.
  findByIdForUpdate(id: string) {
    return this.db
      .select(publicRoleColumns)
      .from(role)
      .where(and(eq(role.id, id), tenantEq(role, this.tenantId)))
      .for('update')
      .then((r) => r[0]);
  }

  findPermissions(roleId: string): Promise<RolePermissionRow[]> {
    return this.db
      .select(rolePermissionColumns)
      .from(rolePermission)
      .where(and(eq(rolePermission.roleId, roleId), tenantEq(rolePermission, this.tenantId)))
      .orderBy(asc(rolePermission.resource), asc(rolePermission.action));
  }

  findNames() {
    return this.db
      .select({ name: role.name })
      .from(role)
      .where(tenantEq(role, this.tenantId))
      .then((rows) => rows.map((r) => r.name));
  }

  countMembers(roleId: string) {
    return this.db
      .select({ value: count() })
      .from(member)
      .where(and(eq(member.roleId, roleId), eq(member.organizationId, this.tenantId)))
      .then((r) => r[0]?.value ?? 0);
  }

  insert(name: string) {
    return this.db
      .insert(role)
      .values({ name, tenantId: this.tenantId })
      .returning(publicRoleColumns)
      .then((r) => r[0]!);
  }

  updateVersioned(id: string, expectedVersion: number, data: { name: string }) {
    return this.db
      .update(role)
      .set({ name: data.name, version: sql`${role.version} + 1`, updatedAt: new Date() })
      .where(and(eq(role.id, id), tenantEq(role, this.tenantId), eq(role.version, expectedVersion)))
      .returning(publicRoleColumns)
      .then((r) => r[0]);
  }

  async replacePermissions(roleId: string, permissions: readonly RolePermissionRow[]) {
    await this.db
      .delete(rolePermission)
      .where(and(eq(rolePermission.roleId, roleId), tenantEq(rolePermission, this.tenantId)));
    await this.insertPermissions(roleId, permissions);
  }

  async insertPermissions(roleId: string, permissions: readonly RolePermissionRow[]) {
    if (permissions.length === 0) return;
    await this.db.insert(rolePermission).values(
      permissions.map((p) => ({
        resource: p.resource,
        action: p.action,
        scope: p.scope,
        roleId,
        tenantId: this.tenantId,
      })),
    );
  }

  deleteById(id: string) {
    return this.db
      .delete(role)
      .where(and(eq(role.id, id), tenantEq(role, this.tenantId)))
      .returning({ id: role.id })
      .then((r) => r[0]);
  }

  async insertAudit(entry: {
    actorUserId: string;
    roleId: string | null;
    action: RoleAuditAction;
    before: RoleAuditSnapshot | null;
    after: RoleAuditSnapshot | null;
  }) {
    await this.db.insert(roleAuditLog).values({ ...entry, tenantId: this.tenantId });
  }
}
