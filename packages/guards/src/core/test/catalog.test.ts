import { describe, expect, it } from 'vitest';
import {
  TENANT_PERMISSIONS,
  catalogActions,
  catalogResources,
  isCatalogPermission,
} from '../catalog';

describe('catalog', () => {
  it('accepts known permissions and rejects unknown ones', () => {
    expect(isCatalogPermission('quote', 'read')).toBe(true);
    expect(isCatalogPermission('quote', 'nope')).toBe(false);
    expect(isCatalogPermission('ghost', 'read')).toBe(false);
  });

  it('includes the role resource', () => {
    expect(isCatalogPermission('role', 'update')).toBe(true);
  });

  it('keeps the Better Auth user permissions that tenant procedures check', () => {
    expect(catalogActions('user')).toEqual(['create', 'list', 'delete', 'set-password', 'update']);
    for (const action of catalogActions('user'))
      expect(isCatalogPermission('user', action)).toBe(true);
  });

  it.each(['get', 'set-role', 'ban', 'impersonate', 'impersonate-admins', 'set-email'])(
    'does not let a tenant role grant user.%s',
    (action) => {
      expect(isCatalogPermission('user', action)).toBe(false);
    },
  );

  it('does not let a tenant role grant any session permission', () => {
    expect(catalogResources()).not.toContain('session');
    for (const action of ['list', 'revoke', 'delete'])
      expect(isCatalogPermission('session', action)).toBe(false);
  });

  it('exposes the same catalog through TENANT_PERMISSIONS', () => {
    expect(Object.keys(TENANT_PERMISSIONS)).toEqual(catalogResources());
    for (const resource of catalogResources())
      expect(TENANT_PERMISSIONS[resource]).toEqual(catalogActions(resource));
  });

  it('lists actions per resource', () => {
    expect(catalogActions('role')).toEqual(['create', 'read', 'update', 'delete']);
    expect(catalogActions('ghost')).toEqual([]);
  });
});
