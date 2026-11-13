import { describe, expect, it } from 'vitest';
import { checkDatabaseUrls } from '../preflight';

const url = (user: string) => `postgres://${user}:pw@localhost:5432/mach_db`;

const valid = {
  DATABASE_OWNER_URL: url('admin'),
  DATABASE_APP_URL: url('app'),
  DATABASE_PLATFORM_URL: url('platform'),
};

describe('checkDatabaseUrls', () => {
  it('accepts three URLs that name three different roles', () => {
    expect(() => checkDatabaseUrls(valid)).not.toThrow();
  });

  it.each(['DATABASE_OWNER_URL', 'DATABASE_APP_URL', 'DATABASE_PLATFORM_URL'] as const)(
    'names %s when it is missing',
    (name) => {
      expect(() => checkDatabaseUrls({ ...valid, [name]: undefined })).toThrow(name);
    },
  );

  it('rejects an app URL that still uses the owner role', () => {
    expect(() => checkDatabaseUrls({ ...valid, DATABASE_APP_URL: url('admin') })).toThrow(
      /three different roles/,
    );
  });

  it('rejects a platform URL that uses the owner role', () => {
    expect(() => checkDatabaseUrls({ ...valid, DATABASE_PLATFORM_URL: url('admin') })).toThrow(
      /three different roles/,
    );
  });

  it('ignores a leftover DATABASE_URL', () => {
    expect(() =>
      checkDatabaseUrls({ ...valid, DATABASE_APP_URL: undefined, DATABASE_URL: url('app') }),
    ).toThrow('DATABASE_APP_URL');
  });
});
