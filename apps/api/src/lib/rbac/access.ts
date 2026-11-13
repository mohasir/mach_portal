import { and, eq } from 'drizzle-orm';
import { isCatalogPermission, permissionKey, type AccessGrants } from '@repo/guards';
import { db, type Executor } from '../../db';
import { member, role, rolePermission } from '../../db/schema';
import { tenantEq } from '../tenancy/tenantEq';

export type ResolvedAccess = AccessGrants & {
  roleId: string | null;
  roleName: string | null;
  roleVersion: number | null;
};

// Synthetic access of a platform admin acting in a tenant where they hold no membership.
export const OWNER_ACCESS: ResolvedAccess = Object.freeze({
  isOwner: true,
  grants: Object.freeze({}) as Record<string, never>,
  roleId: null,
  roleName: null,
  roleVersion: null,
});

export function permissionsVersion(access: ResolvedAccess): string {
  return access.roleId === null ? 'owner:0' : `${access.roleId}:${access.roleVersion}`;
}

// Fails closed: no membership, a null role_id, or a role_id pointing at another tenant's role all
// resolve to null. Read on every request with no cache so a role edit applies on the next call.
export async function resolveAccess(
  input: { userId: string; tenantId: string },
  x: Executor = db,
): Promise<ResolvedAccess | null> {
  const rows = await x
    .select({
      roleId: role.id,
      roleName: role.name,
      isOwner: role.isOwner,
      version: role.version,
      resource: rolePermission.resource,
      action: rolePermission.action,
      scope: rolePermission.scope,
    })
    .from(member)
    .leftJoin(role, and(eq(role.id, member.roleId), tenantEq(role, input.tenantId)))
    .leftJoin(
      rolePermission,
      and(eq(rolePermission.roleId, role.id), tenantEq(rolePermission, input.tenantId)),
    )
    .where(and(eq(member.userId, input.userId), eq(member.organizationId, input.tenantId)));

  const first = rows[0];
  if (!first?.roleId || first.roleName === null || first.isOwner === null || first.version === null)
    return null;

  const grants: AccessGrants['grants'] = {};
  for (const row of rows) {
    if (row.resource === null || row.action === null || row.scope === null) continue;
    if (!isCatalogPermission(row.resource, row.action)) continue;
    grants[permissionKey(row.resource, row.action)] = row.scope;
  }
  return {
    isOwner: first.isOwner,
    grants,
    roleId: first.roleId,
    roleName: first.roleName,
    roleVersion: first.version,
  };
}
