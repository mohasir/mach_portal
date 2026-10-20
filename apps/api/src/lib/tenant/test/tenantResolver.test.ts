import { beforeEach, describe, expect, it, vi } from 'vitest';

const select = vi.hoisted(() => vi.fn());
vi.mock('../../../db', () => ({ db: { select } }));

import { resolveTenantBySlug, invalidateTenantCache } from '../tenantResolver';

describe('resolveTenantBySlug (invalid slugs)', () => {
  beforeEach(() => {
    select.mockClear();
    invalidateTenantCache();
  });

  it.each(['a@b', 'A', '-a', 'a_b', '', 'a b', 'www'])(
    'returns null without querying the db for %j',
    async (slug) => {
      await expect(resolveTenantBySlug(slug)).resolves.toBeNull();
      expect(select).not.toHaveBeenCalled();
    },
  );
});
