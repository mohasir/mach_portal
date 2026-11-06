import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabaseUrl } from './dbGuard';

describe('assertSafeTestDatabaseUrl', () => {
  it.each([undefined, ''])('rejects a missing URL (%j)', (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/TEST_DATABASE_URL/);
  });

  it.each([
    'postgres://u:p@db.example.com:5432/app',
    'postgres://u:p@10.0.0.5:5432/app',
    'postgres://u:p@localhost.evil.com:5432/app',
    'postgres://localhost:5432@evil.com/app',
  ])('rejects a non-local host (%s)', (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/localhost|127\.0\.0\.1/);
  });

  it.each([
    'postgres://u:p@localhost/db?host=remote.example.com',
    'postgres://u:p@localhost/db?hostaddr=10.0.0.5',
    'postgres://u:p@localhost/db?port=5433',
    'postgres://u:p@localhost/db?sslmode=disable',
  ])('rejects query parameters (%s)', (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/query parameters/);
  });

  it.each([
    'postgres://u:p@localhost#,remote.example.com/db',
    'postgres://u:p@localhost:5432#,remote.example.com/db',
    'postgres://u:p@localhost,remote.example.com/db',
    'postgres://u:p@localhost/db#x',
  ])('rejects parser-disagreement forms (%s)', (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow();
  });

  it.each(['postgres://u:p@localhost/db\n', 'POSTGRES://u:p@localhost/db', 'http://localhost/db'])(
    'rejects forms outside the strict allowlist (%j)',
    (url) => {
      expect(() => assertSafeTestDatabaseUrl(url)).toThrow(/postgres:\/\//);
    },
  );

  it('rejects an unparseable URL', () => {
    expect(() => assertSafeTestDatabaseUrl('not a url')).toThrow(/TEST_DATABASE_URL/);
  });

  it.each([
    'postgres://u:p@localhost:5432/test',
    'postgres://u:p@127.0.0.1:5433/test',
    'postgres://localhost/test',
    'postgres://mach_admin:mach12345678@localhost:5432/mach_db',
    'postgres://u:p@127.0.0.1/test',
    'postgres://u:p:q@localhost/test',
  ])('accepts a local host (%s)', (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).not.toThrow();
  });
});
