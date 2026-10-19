// Strict allowlist on the raw string so a disagreement between WHATWG URL and the
// postgres driver's own parser (e.g. '#', ',' multihost, a second '@') cannot slip through.
const SAFE_URL =
  /^postgres(?:ql)?:\/\/(?:[^\s@/#?,:]*(?::[^\s@/#?,]*)?@)?(?:localhost|127\.0\.0\.1)(?::\d{1,5})?\/[A-Za-z0-9_-]+$/;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

// Integration setup wipes the target database, so it must never be able to reach
// anything but a local instance, and must never fall back to the app's DATABASE_URL.
export function assertSafeTestDatabaseUrl(url: string | undefined): void {
  if (!url) {
    throw new Error('TEST_DATABASE_URL must be set explicitly for integration tests');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL');
  }
  const { hostname } = parsed;

  // The postgres driver and libpq let query params (host, hostaddr, port) override the
  // authority, so any param could redirect the wipe to a remote server.
  if (parsed.search) {
    throw new Error('Refusing to run integration tests: TEST_DATABASE_URL must not have query parameters');
  }

  if (parsed.hash) {
    throw new Error('Refusing to run integration tests: TEST_DATABASE_URL must not have a fragment');
  }

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to run integration tests: TEST_DATABASE_URL host "${hostname}" is not localhost or 127.0.0.1`,
    );
  }

  if (!SAFE_URL.test(url)) {
    throw new Error(
      'Refusing to run integration tests: TEST_DATABASE_URL must be postgres://[user[:pass]@](localhost|127.0.0.1)[:port]/<database>',
    );
  }
}
