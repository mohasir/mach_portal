import type { Sql } from 'postgres';
import { requireDatabaseUrl } from '../databaseUrls';

export type RoleCredentials = {
  appRole: string;
  appPassword: string;
  platformRole: string;
  platformPassword: string;
};

export type EnsureRolesOptions = RoleCredentials & {
  // Role that owns the tables (runs the migrations); default privileges are set for its future objects.
  ownerRole: string;
};

// Utility statements (CREATE/ALTER ROLE) take no bind parameters, so names and passwords travel as
// transaction-local settings and are quoted server-side with format(): they never end up in the
// statement text or in logs of it.
const ENSURE_ROLES_SQL = `
DO $$
DECLARE
  app_role text := current_setting('mach_roles.app_role');
  app_password text := current_setting('mach_roles.app_password');
  platform_role text := current_setting('mach_roles.platform_role');
  platform_password text := current_setting('mach_roles.platform_password');
  owner_role text := current_setting('mach_roles.owner_role');
  existing record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    EXECUTE format('CREATE ROLE %I', app_role);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = platform_role) THEN
    EXECUTE format('CREATE ROLE %I', platform_role);
  END IF;

  -- Attributes are only touched when they differ: a CREATEROLE (non-superuser) admin, as on
  -- managed providers, may not be allowed to state SUPERUSER/BYPASSRLS at all.
  SELECT rolsuper, rolbypassrls INTO existing FROM pg_roles WHERE rolname = app_role;
  IF existing.rolsuper THEN
    EXECUTE format('ALTER ROLE %I NOSUPERUSER', app_role);
  END IF;
  IF existing.rolbypassrls THEN
    EXECUTE format('ALTER ROLE %I NOBYPASSRLS', app_role);
  END IF;
  SELECT rolbypassrls INTO existing FROM pg_roles WHERE rolname = platform_role;
  IF NOT existing.rolbypassrls THEN
    EXECUTE format('ALTER ROLE %I BYPASSRLS', platform_role);
  END IF;

  EXECUTE format('ALTER ROLE %I WITH LOGIN NOCREATEDB NOCREATEROLE PASSWORD %L', app_role, app_password);
  EXECUTE format('ALTER ROLE %I WITH LOGIN NOCREATEDB NOCREATEROLE PASSWORD %L', platform_role, platform_password);

  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I, %I', app_role, platform_role);
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I, %I',
    app_role, platform_role);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I, %I', app_role, platform_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I, %I',
    owner_role, app_role, platform_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I, %I',
    owner_role, app_role, platform_role);
END
$$;
`;

export async function ensureRoles(sql: Sql, options: EnsureRolesOptions): Promise<void> {
  const { appRole, appPassword, platformRole, platformPassword, ownerRole } = options;
  if (!appRole || !platformRole) throw new Error('Role names must not be empty');
  if (!appPassword || !platformPassword) throw new Error('Role passwords must not be empty');
  // The script would otherwise strip BYPASSRLS from (or grant it to) the role it connects with.
  if (new Set([appRole, platformRole, ownerRole]).size !== 3) {
    throw new Error(
      `The app role ("${appRole}"), the platform role ("${platformRole}") and the owner role ` +
        `("${ownerRole}") must be three different roles`,
    );
  }

  await sql.begin(async (tx) => {
    await tx`
      SELECT
        set_config('mach_roles.app_role', ${appRole}, true),
        set_config('mach_roles.app_password', ${appPassword}, true),
        set_config('mach_roles.platform_role', ${platformRole}, true),
        set_config('mach_roles.platform_password', ${platformPassword}, true),
        set_config('mach_roles.owner_role', ${ownerRole}, true)`;
    await tx.unsafe(ENSURE_ROLES_SQL);
  });
}

type Source = Record<string, string | undefined>;

// Decoded exactly as the postgres driver decodes them, so the role created here can log in with the
// very same URL.
function credentialsFrom(name: 'DATABASE_APP_URL' | 'DATABASE_PLATFORM_URL', source: Source) {
  const url = new URL(requireDatabaseUrl(name, source));
  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error(`${name} has an invalid percent-encoding in its user or password.`);
  }
  if (!user || !password) {
    throw new Error(
      `${name} must include a user and a password: db:roles creates that role with them.`,
    );
  }
  return { user, password };
}

export function readRoleCredentials(source: Source): RoleCredentials {
  const app = credentialsFrom('DATABASE_APP_URL', source);
  const platform = credentialsFrom('DATABASE_PLATFORM_URL', source);
  if (app.user === platform.user) {
    throw new Error('DATABASE_APP_URL and DATABASE_PLATFORM_URL must name different roles.');
  }
  return {
    appRole: app.user,
    appPassword: app.password,
    platformRole: platform.user,
    platformPassword: platform.password,
  };
}

