import { describe, expect, it } from 'vitest';
import { parseTenantSlug } from '../host';

describe('parseTenantSlug', () => {
  const base = 'oravitech.test';

  it.each([
    ['Cliente.Oravitech.test:443', 'cliente'],
    ['cliente.oravitech.test.', 'cliente'],
    ['oravitech.test', null],
    ['a.b.oravitech.test', null],
    ['cliente.oravitech.test.evil.com', null],
    ['evil-oravitech.test', null],
    [undefined, null],
  ])('resolves %s to %s', (host, expected) => {
    expect(parseTenantSlug(host, base)).toBe(expected);
  });

  it('supports a base domain that includes a port', () => {
    expect(parseTenantSlug('cliente.localhost:3000', 'localhost:3000')).toBe('cliente');
  });
});
