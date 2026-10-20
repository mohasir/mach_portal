import { describe, expect, it } from 'vitest';
import { readTenantHost } from '../forwardedHost';

const KEY = 'test-internal-proxy-key';

describe('readTenantHost', () => {
  it('returns the host when the internal key matches', () => {
    expect(readTenantHost({ 'x-tenant-host': 'a.oravitech.test', 'x-internal-key': KEY })).toBe(
      'a.oravitech.test',
    );
  });

  it('ignores the host when the key is missing', () => {
    expect(readTenantHost({ 'x-tenant-host': 'a.oravitech.test' })).toBeUndefined();
  });

  it('ignores the host when the key is wrong', () => {
    expect(
      readTenantHost({
        'x-tenant-host': 'a.oravitech.test',
        'x-internal-key': 'x'.repeat(KEY.length),
      }),
    ).toBeUndefined();
  });

  it('ignores the host when the key has a different length', () => {
    expect(
      readTenantHost({ 'x-tenant-host': 'a.oravitech.test', 'x-internal-key': `${KEY}-extra` }),
    ).toBeUndefined();
    expect(
      readTenantHost({ 'x-tenant-host': 'a.oravitech.test', 'x-internal-key': 'short' }),
    ).toBeUndefined();
  });

  it('ignores repeated (array) headers', () => {
    expect(
      readTenantHost({
        'x-tenant-host': ['a.oravitech.test', 'b.oravitech.test'],
        'x-internal-key': KEY,
      }),
    ).toBeUndefined();
    expect(
      readTenantHost({ 'x-tenant-host': 'a.oravitech.test', 'x-internal-key': [KEY, KEY] }),
    ).toBeUndefined();
  });

  it('returns undefined when the host header is absent even with a valid key', () => {
    expect(readTenantHost({ 'x-internal-key': KEY })).toBeUndefined();
  });
});
