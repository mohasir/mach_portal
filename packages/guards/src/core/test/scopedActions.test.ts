import { describe, expect, it } from 'vitest';
import { isCatalogPermission } from '../catalog';
import { SCOPED_ACTIONS, supportsScope } from '../scopedActions';

describe('SCOPED_ACTIONS', () => {
  it('only lists catalog permissions', () => {
    for (const [resource, actions] of Object.entries(SCOPED_ACTIONS)) {
      for (const action of actions) expect(isCatalogPermission(resource, action)).toBe(true);
    }
  });

  it('answers per (resource, action) pair', () => {
    expect(supportsScope('quote', 'read')).toBe(true);
    expect(supportsScope('payment', 'read')).toBe(true);
    expect(supportsScope('quote', 'create')).toBe(false);
    expect(supportsScope('quote', 'manage_assignment')).toBe(false);
    expect(supportsScope('quote', 'view_archived')).toBe(false);
    expect(supportsScope('event', 'create')).toBe(false);
    expect(supportsScope('client', 'read')).toBe(false);
    expect(supportsScope('ghost', 'read')).toBe(false);
  });
});
