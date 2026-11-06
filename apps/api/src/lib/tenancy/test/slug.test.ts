import { describe, expect, it } from 'vitest';
import { isValidSlug } from '../slug';

describe('isValidSlug', () => {
  it('accepts a lowercase alphanumeric slug with hyphens', () => {
    expect(isValidSlug('acme-2')).toBe(true);
  });

  it.each(['Cliente', 'a', '-x-', 'x_y', '', 'a b'])('rejects %j', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});
