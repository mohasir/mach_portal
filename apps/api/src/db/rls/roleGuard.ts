import type { Sql } from 'postgres';

export type RoleBypass = { rolname: string; reasons: string[] };

interface RoleAttributes {
  rolname: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  rolcreaterole: boolean;
}

interface BypassRoleMembership {
  rolname: string;
  rolsuper: boolean;
}

// Why the connection's role skips Row Level Security: superusers and BYPASSRLS roles skip it
// silently, and so does any role that can SET ROLE to one of them (membership is inherited
// transitively, which pg_has_role(..., 'MEMBER') follows) or that can grant itself such a
// membership (CREATEROLE).
export async function rlsBypassReasons(sql: Sql): Promise<RoleBypass> {
  const [role] = await sql<RoleAttributes[]>`
    SELECT rolname, rolsuper, rolbypassrls, rolcreaterole FROM pg_roles
    WHERE rolname = current_user`;
  if (!role) throw new Error('Could not read the attributes of the current database role');

  const reasons: string[] = [];
  if (role.rolsuper) reasons.push('is a superuser');
  if (role.rolbypassrls) reasons.push('has BYPASSRLS');
  // A superuser is a member of every role, so the list would only repeat the first reason.
  if (!role.rolsuper) {
    if (role.rolcreaterole) {
      reasons.push('has CREATEROLE (it could grant itself a role that bypasses RLS)');
    }
    const granted = await sql<BypassRoleMembership[]>`
      SELECT rolname, rolsuper FROM pg_roles
      WHERE rolname <> current_user
        AND (rolsuper OR rolbypassrls)
        AND pg_has_role(current_user, oid, 'MEMBER')
      ORDER BY rolname`;
    for (const g of granted) {
      reasons.push(`is a member of "${g.rolname}" (${g.rolsuper ? 'superuser' : 'BYPASSRLS'})`);
    }
  }
  return { rolname: role.rolname, reasons };
}

// Row Level Security is the last line of tenant isolation, so the API refuses to serve requests
// through a role that skips it.
export async function assertAppRoleRestricted(sql: Sql): Promise<void> {
  const { rolname, reasons } = await rlsBypassReasons(sql);
  if (reasons.length === 0) return;

  throw new Error(
    `Refusing to start: DATABASE_APP_URL role "${rolname}" ${reasons.join(' and ')}, so Row Level ` +
      'Security would not isolate organizations. Create the restricted roles with ' +
      '`pnpm --filter api db:roles` and point DATABASE_APP_URL to the "app" role.',
  );
}
