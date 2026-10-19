import { describe, expect, it } from 'vitest';
import { isValidSlug, RESERVED_SLUGS } from './slug';

describe('isValidSlug', () => {
  it('accepts a lowercase alphanumeric slug with hyphens', () => {
    expect(isValidSlug('acme-2')).toBe(true);
  });

  it.each(['admin', 'Cliente', 'a', '-x-', 'x_y'])('rejects %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });

  it('rejects every reserved slug', () => {
    for (const slug of RESERVED_SLUGS) expect(isValidSlug(slug)).toBe(false);
  });
});
