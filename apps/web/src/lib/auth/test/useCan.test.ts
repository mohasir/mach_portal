import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, RESOURCES, type AccessGrants } from '@repo/guards';

const state = vi.hoisted(() => ({ access: undefined as AccessGrants | undefined }));

vi.mock('@/features/tenant', () => ({
  usePermissions: () => ({
    access: state.access,
    version: state.access ? 'r1:1' : undefined,
    isPending: !state.access,
  }),
}));

import { useCan, useCanReassignQuote, useCanRegeneratePdf } from '../useCan';

const readQuotes = { [RESOURCES.QUOTE]: [ACTIONS.READ] };
const deleteQuotes = { [RESOURCES.QUOTE]: [ACTIONS.DELETE] };

describe('useCan', () => {
  beforeEach(() => {
    state.access = undefined;
  });

  it('answers like `can` over the loaded grants', () => {
    state.access = { isOwner: false, grants: { 'quote.read': 'own' } };
    const can = useCan();
    expect(can(readQuotes)).toBe(true);
    expect(can(deleteQuotes)).toBe(false);
  });

  it('denies everything while the permissions are still loading', () => {
    const can = useCan();
    expect(can(readQuotes)).toBe(false);
    expect(useCanReassignQuote()).toBe(false);
  });

  it('lets the owner through every check', () => {
    state.access = { isOwner: true, grants: {} };
    expect(useCan()(deleteQuotes)).toBe(true);
    expect(useCanReassignQuote()).toBe(true);
    expect(useCanRegeneratePdf()).toBe(true);
  });

  it('reads the quote-specific gates from the same grants', () => {
    state.access = { isOwner: false, grants: { 'quote.manage_assignment': 'all' } };
    expect(useCanReassignQuote()).toBe(true);
    expect(useCanRegeneratePdf()).toBe(false);
  });
});
