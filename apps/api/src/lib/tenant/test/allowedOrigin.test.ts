import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveTenantBySlug = vi.hoisted(() => vi.fn());
vi.mock('../tenantResolver', () => ({ resolveTenantBySlug }));

import { isAllowedOrigin } from '../allowedOrigin';

// Unit env: APP_BASE_DOMAIN = oravitech.test, APP_PROTOCOL = https.
describe('isAllowedOrigin', () => {
  beforeEach(() => {
    resolveTenantBySlug.mockReset();
    resolveTenantBySlug.mockImplementation(async (slug: string) =>
      slug === 'acme' ? { id: '1', slug: 'acme', name: 'Acme' } : null,
    );
  });

  it('accepts an existing tenant subdomain over the configured protocol', async () => {
    await expect(isAllowedOrigin('https://acme.oravitech.test')).resolves.toBe(true);
    expect(resolveTenantBySlug).toHaveBeenCalledWith('acme');
  });

  it('rejects an unknown slug', async () => {
    await expect(isAllowedOrigin('https://ghost.oravitech.test')).resolves.toBe(false);
  });

  it.each([
    ['suffix attack', 'https://acme.oravitech.test.evil.com'],
    ['prefix attack', 'https://evil-oravitech.test'],
    ['prefixed label', 'https://evilacme.oravitech.test.evil.com'],
    ['wrong protocol', 'http://acme.oravitech.test'],
    ['nested subdomain', 'https://x.acme.oravitech.test'],
    ['bare base domain', 'https://oravitech.test'],
    ['unexpected port', 'https://acme.oravitech.test:8443'],
    ['userinfo', 'https://acme.oravitech.test@evil.com'],
    ['userinfo before the host', 'https://evil.com@acme.oravitech.test'],
    ['path', 'https://acme.oravitech.test/path'],
    ['trailing slash', 'https://acme.oravitech.test/'],
    ['uppercase host', 'https://ACME.oravitech.test'],
    ['reserved slug', 'https://www.oravitech.test'],
    ['invalid slug', 'https://-acme.oravitech.test'],
    ['malformed', 'not a url'],
    ['opaque origin', 'null'],
    ['empty', ''],
    ['other scheme', 'javascript://acme.oravitech.test'],
  ])('rejects %s (%s)', async (_label, origin) => {
    await expect(isAllowedOrigin(origin)).resolves.toBe(false);
  });

  it('rejects undefined without querying', async () => {
    await expect(isAllowedOrigin(undefined)).resolves.toBe(false);
    expect(resolveTenantBySlug).not.toHaveBeenCalled();
  });

  it('fails closed when the lookup throws', async () => {
    resolveTenantBySlug.mockRejectedValueOnce(new Error('db down'));
    await expect(isAllowedOrigin('https://acme.oravitech.test')).resolves.toBe(false);
  });

  it('recovers after a lookup failure (failure is not remembered)', async () => {
    resolveTenantBySlug.mockRejectedValueOnce(new Error('db down'));
    await isAllowedOrigin('https://acme.oravitech.test');
    await expect(isAllowedOrigin('https://acme.oravitech.test')).resolves.toBe(true);
  });
});
