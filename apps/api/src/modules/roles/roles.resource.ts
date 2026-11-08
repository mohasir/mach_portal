import { role, rolePermission } from '../../db/schema';

export const publicRoleColumns = {
  id: role.id,
  name: role.name,
  isOwner: role.isOwner,
  version: role.version,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
} as const;

export const rolePermissionColumns = {
  resource: rolePermission.resource,
  action: rolePermission.action,
  scope: rolePermission.scope,
} as const;

export type PublicRole = Pick<typeof role.$inferSelect, keyof typeof publicRoleColumns>;
export type RolePermissionRow = Pick<
  typeof rolePermission.$inferSelect,
  keyof typeof rolePermissionColumns
>;
export type RoleSummaryRow = PublicRole & { memberCount: number };
export type RoleDetailRow = RoleSummaryRow & { permissions: RolePermissionRow[] };

const permissionResource = (p: RolePermissionRow) => ({
  resource: p.resource,
  action: p.action,
  scope: p.scope,
});

export const roleSummaryResource = (row: RoleSummaryRow) => ({
  id: row.id,
  name: row.name,
  isOwner: row.isOwner,
  version: row.version,
  memberCount: row.memberCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const roleSummaryCollectionResource = (rows: RoleSummaryRow[]) =>
  rows.map(roleSummaryResource);

export const roleResource = (row: RoleDetailRow) => ({
  ...roleSummaryResource(row),
  permissions: row.permissions.map(permissionResource),
});

// Shape stored in role_audit_log.before/after; it carries the id because the log's role_id is
// nulled when the role is deleted.
export const roleAuditSnapshot = (row: PublicRole & { permissions: RolePermissionRow[] }) => ({
  id: row.id,
  name: row.name,
  isOwner: row.isOwner,
  version: row.version,
  permissions: row.permissions.map(permissionResource),
});

export type RoleSummaryResource = ReturnType<typeof roleSummaryResource>;
export type RoleResource = ReturnType<typeof roleResource>;
export type RoleAuditSnapshot = ReturnType<typeof roleAuditSnapshot>;
