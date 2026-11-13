import { describe, expect, it } from 'vitest';
import { requireDatabaseUrl } from '../databaseUrls';

describe('requireDatabaseUrl', () => {
  it('returns the URL of the requested role', () => {
    const source = {
      DATABASE_APP_URL: 'postgres://app@localhost/db',
      DATABASE_PLATFORM_URL: 'postgres://platform@localhost/db',
    };
    expect(requireDatabaseUrl('DATABASE_PLATFORM_URL', source)).toBe(
      'postgres://platform@localhost/db',
    );
  });

  it('never falls back to another variable and names the missing one', () => {
    const source = { DATABASE_APP_URL: 'postgres://app@localhost/db' };
    expect(() => requireDatabaseUrl('DATABASE_PLATFORM_URL', source)).toThrow(
      /Missing required environment variable DATABASE_PLATFORM_URL/,
    );
    // The name providers such as Railway or Neon inject; a leftover one must not be picked up.
    expect(() =>
      requireDatabaseUrl('DATABASE_APP_URL', { DATABASE_URL: 'postgres://app@localhost/db' }),
    ).toThrow(/Missing required environment variable DATABASE_APP_URL/);
    expect(() => requireDatabaseUrl('DATABASE_OWNER_URL', { DATABASE_OWNER_URL: '  ' })).toThrow(
      /Missing required environment variable DATABASE_OWNER_URL/,
    );
  });

  it('rejects a value that is not a URL without echoing it', () => {
    const run = () => requireDatabaseUrl('DATABASE_OWNER_URL', { DATABASE_OWNER_URL: 'secret-pw' });
    expect(run).toThrow(/DATABASE_OWNER_URL is not a valid connection URL/);
    expect(run).not.toThrow(/secret-pw/);
  });
});
