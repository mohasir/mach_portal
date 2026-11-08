import { eq } from 'drizzle-orm';
import { ROLE_TEMPLATES, ROLES, type RoleType } from '@repo/guards';
import { db, type Executor } from '../../db';
import { role, rolePermission } from '../../db/schema';

// Single place that maps a role key to the legacy member.role text, which Better Auth still reads.
export function legacyMemberRole(key: RoleType): string {
  return key;
}

// Base roles are recognized the same way seedTenantRoles matches them (owner by flag, the rest by
// template name). A custom or renamed role has no legacy key, so it gets the least privileged one:
// the legacy column must never suggest more power than the role actually grants.
export function legacyMemberRoleOf(r: { name: string; isOwner: boolean }): string {
  const tpl = r.isOwner
    ? ROLE_TEMPLATES.find((t) => t.isOwner)
    : ROLE_TEMPLATES.find((t) => !t.isOwner && t.name === r.name);
  return legacyMemberRole(tpl?.key ?? ROLES.MEMBER);
}

// Creates the base roles a tenant is missing, with their permission rows. Idempotent: an existing
// role (the owner is matched by is_owner, the others by name) is reused as is, so permissions that
// the tenant removed or edited are never restored. Runs in one transaction; given a transaction
// it joins it through a savepoint.
export async function seedTenantRoles(
  tenantId: string,
  x: Executor = db,
): Promise<Record<RoleType, string>> {
  return x.transaction(async (tx) => {
    const existing = await tx
      .select({ id: role.id, name: role.name, isOwner: role.isOwner })
      .from(role)
      .where(eq(role.tenantId, tenantId));
    const findExisting = (tpl: (typeof ROLE_TEMPLATES)[number]) =>
      tpl.isOwner ? existing.find((r) => r.isOwner) : existing.find((r) => r.name === tpl.name);

    const ids = {} as Record<RoleType, string>;
    const missing = ROLE_TEMPLATES.filter((tpl) => {
      const found = findExisting(tpl);
      if (found) ids[tpl.key] = found.id;
      return !found;
    });
    if (missing.length === 0) return ids;

    const created = await tx
      .insert(role)
      .values(missing.map((tpl) => ({ tenantId, name: tpl.name, isOwner: tpl.isOwner })))
      .onConflictDoNothing()
      .returning({ id: role.id, name: role.name });

    for (const tpl of missing) {
      const row = created.find((r) => r.name === tpl.name);
      if (!row) {
        throw new Error(
          `Cannot seed role "${tpl.name}" for tenant ${tenantId}: the name is already taken or a concurrent seed created it`,
        );
      }
      ids[tpl.key] = row.id;
    }

    const permissions = missing.flatMap((tpl) =>
      tpl.permissions.map((p) => ({ ...p, roleId: ids[tpl.key], tenantId })),
    );
    if (permissions.length > 0) await tx.insert(rolePermission).values(permissions);
    return ids;
  });
}
