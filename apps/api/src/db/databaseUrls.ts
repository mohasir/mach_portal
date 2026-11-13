export type DatabaseUrlVariable =
  | 'DATABASE_APP_URL'
  | 'DATABASE_OWNER_URL'
  | 'DATABASE_PLATFORM_URL';

const ROLE_OF: Record<DatabaseUrlVariable, string> = {
  DATABASE_APP_URL: 'the restricted "app" role the API connects with',
  DATABASE_OWNER_URL: 'the role that owns the tables and runs migrations',
  DATABASE_PLATFORM_URL: 'the "platform" role (BYPASSRLS) for scripts that cross organizations',
};

// Each script names the role it needs; falling back to another variable would silently run it with
// another role's privileges (as `app`, for instance, every tenant table looks empty).
export function requireDatabaseUrl(
  name: DatabaseUrlVariable,
  source: Record<string, string | undefined> = process.env,
): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}: the connection URL of ${ROLE_OF[name]}.`,
    );
  }
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} is not a valid connection URL.`);
  }
  return value;
}
