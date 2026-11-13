import { describe, expect, it } from 'vitest';
import type { Sql } from 'postgres';
import { ensureRoles, readRoleCredentials } from '../roles';

const SPECIAL_PASSWORD = `p@ss:w/rd%?#&= é'"\\`;

const urlFor = (user: string, password: string) =>
  `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:5432/mach_db`;

describe('readRoleCredentials', () => {
  it('reads the role names and passwords from the app and platform URLs', () => {
    expect(
      readRoleCredentials({
        DATABASE_APP_URL: urlFor('app', 'a'),
        DATABASE_PLATFORM_URL: urlFor('platform', 'b'),
      }),
    ).toEqual({ appRole: 'app', appPassword: 'a', platformRole: 'platform', platformPassword: 'b' });
  });

  it('decodes percent-encoded characters in the user and password', () => {
    const credentials = readRoleCredentials({
      DATABASE_APP_URL: urlFor('app user', SPECIAL_PASSWORD),
      DATABASE_PLATFORM_URL: urlFor('platform', SPECIAL_PASSWORD),
    });
    expect(credentials.appRole).toBe('app user');
    expect(credentials.appPassword).toBe(SPECIAL_PASSWORD);
    expect(credentials.platformPassword).toBe(SPECIAL_PASSWORD);
  });

  it('names the missing variable and never falls back to DATABASE_URL', () => {
    expect(() =>
      readRoleCredentials({
        DATABASE_URL: urlFor('app', 'a'),
        DATABASE_PLATFORM_URL: urlFor('platform', 'b'),
      }),
    ).toThrow(/Missing required environment variable DATABASE_APP_URL/);
    expect(() => readRoleCredentials({ DATABASE_APP_URL: urlFor('app', 'a') })).toThrow(
      /Missing required environment variable DATABASE_PLATFORM_URL/,
    );
  });

  it('rejects a URL without a password, naming the variable but not its value', () => {
    const run = () =>
      readRoleCredentials({
        DATABASE_APP_URL: urlFor('app', 'secret-value'),
        DATABASE_PLATFORM_URL: 'postgres://platform@localhost:5432/mach_db',
      });
    expect(run).toThrow(/DATABASE_PLATFORM_URL must include a user and a password/);
    expect(run).not.toThrow(/secret-value|localhost/);
  });

  it('rejects a URL without a user', () => {
    const run = () =>
      readRoleCredentials({
        DATABASE_APP_URL: 'postgres://:secret-value@localhost:5432/mach_db',
        DATABASE_PLATFORM_URL: urlFor('platform', 'b'),
      });
    expect(run).toThrow(/DATABASE_APP_URL must include a user and a password/);
    expect(run).not.toThrow(/secret-value/);
  });

  it('rejects a malformed percent-encoding without echoing it', () => {
    const run = () =>
      readRoleCredentials({
        DATABASE_APP_URL: 'postgres://app:secret%zz@localhost:5432/mach_db',
        DATABASE_PLATFORM_URL: urlFor('platform', 'b'),
      });
    expect(run).toThrow(/DATABASE_APP_URL has an invalid percent-encoding/);
    expect(run).not.toThrow(/secret/);
  });

  it('rejects the same role for app and platform', () => {
    expect(() =>
      readRoleCredentials({
        DATABASE_APP_URL: urlFor('app', 'a'),
        DATABASE_PLATFORM_URL: urlFor('app', 'b'),
      }),
    ).toThrow(/must name different roles/);
  });
});

describe('ensureRoles', () => {
  // Rejected before any statement runs, so no connection is needed.
  const unusedSql = {} as Sql;
  const credentials = {
    appRole: 'app',
    appPassword: 'a',
    platformRole: 'platform',
    platformPassword: 'b',
  };

  it('refuses to manage the owner role it connects with', async () => {
    await expect(ensureRoles(unusedSql, { ...credentials, ownerRole: 'app' })).rejects.toThrow(
      /must be three different roles/,
    );
    await expect(
      ensureRoles(unusedSql, { ...credentials, ownerRole: 'platform' }),
    ).rejects.toThrow(/must be three different roles/);
  });
});
