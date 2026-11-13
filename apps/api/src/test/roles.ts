// Postgres roles are cluster-wide, so the test roles get their own names: running the suite must
// never reset the password of the `app`/`platform` roles a local environment uses.
export const TEST_APP_ROLE = 'mach_test_app';
export const TEST_APP_PASSWORD = 'mach_test_app_password';
export const TEST_PLATFORM_ROLE = 'mach_test_platform';
export const TEST_PLATFORM_PASSWORD = 'mach_test_platform_password';

function testDatabaseUrlAs(user: string, password: string): string {
  const raw = process.env['TEST_DATABASE_URL'];
  if (!raw) throw new Error('TEST_DATABASE_URL is required for integration tests');
  const url = new URL(raw);
  url.username = user;
  url.password = password;
  return url.toString();
}

export const testAppDatabaseUrl = () => testDatabaseUrlAs(TEST_APP_ROLE, TEST_APP_PASSWORD);
export const testPlatformDatabaseUrl = () =>
  testDatabaseUrlAs(TEST_PLATFORM_ROLE, TEST_PLATFORM_PASSWORD);
