import { describe, expect, it } from 'vitest';
import { ROLES } from '../../constants/index';
import { isCatalogPermission } from '../../core/catalog';
import { rolesPermissionsMatrix } from '../rolesPermissions.matrix';
import { ROLE_TEMPLATES } from '../roleTemplates';

const template = (key: string) => ROLE_TEMPLATES.find((t) => t.key === key)!;

describe('ROLE_TEMPLATES', () => {
  it('defines the four base roles', () => {
    expect(ROLE_TEMPLATES.map((t) => t.key).sort()).toEqual(
      [ROLES.ADMIN, ROLES.MEMBER, ROLES.OPERATOR, ROLES.SUPERADMIN].sort(),
    );
  });

  it('marks only superadmin as owner, with no stored permissions', () => {
    expect(ROLE_TEMPLATES.filter((t) => t.isOwner).map((t) => t.key)).toEqual([ROLES.SUPERADMIN]);
    expect(template(ROLES.SUPERADMIN).permissions).toEqual([]);
  });

  it.each([ROLES.ADMIN, ROLES.OPERATOR, ROLES.MEMBER])('%s permissions match the matrix', (key) => {
    const expected = Object.entries(
      rolesPermissionsMatrix.find((r) => r.role === key)!.permissions,
    ).flatMap(([resource, grant]) => {
      const actions = Array.isArray(grant) ? grant : grant.actions;
      const scope = Array.isArray(grant) ? 'all' : grant.scope;
      return actions.map((action: string) => ({ resource, action, scope }));
    });
    const sort = (xs: typeof expected) =>
      [...xs].sort((a, b) =>
        `${a.resource}.${a.action}`.localeCompare(`${b.resource}.${b.action}`),
      );
    expect(sort([...template(key).permissions])).toEqual(sort(expected));
  });

  it('keeps operator scope own on quote and event', () => {
    const perms = template(ROLES.OPERATOR).permissions;
    expect(perms.find((p) => p.resource === 'quote' && p.action === 'read')?.scope).toBe('own');
    expect(perms.find((p) => p.resource === 'event' && p.action === 'read')?.scope).toBe('own');
    expect(perms.find((p) => p.resource === 'client' && p.action === 'read')?.scope).toBe('all');
  });

  it('only holds permissions a tenant role may grant', () => {
    for (const t of ROLE_TEMPLATES)
      for (const p of t.permissions) expect(isCatalogPermission(p.resource, p.action)).toBe(true);
  });

  it('gives units of measure to the roles that administer the catalog, at the product level', () => {
    const actionsOf = (key: string) =>
      template(key)
        .permissions.filter((p) => p.resource === 'unit_of_measure')
        .map((p) => p.action)
        .sort();
    expect(actionsOf(ROLES.ADMIN)).toEqual(['create', 'disable', 'read', 'update']);
    expect(actionsOf(ROLES.OPERATOR)).toEqual(['read']);
    expect(actionsOf(ROLES.MEMBER)).toEqual([]);
    expect(isCatalogPermission('unit_of_measure', 'enable')).toBe(true);
    expect(isCatalogPermission('unit_of_measure', 'delete')).toBe(false);
  });

  it('gives admin a few hard-coded grants', () => {
    const perms = template(ROLES.ADMIN).permissions;
    expect(perms).toContainEqual({ resource: 'user', action: 'list', scope: 'all' });
    expect(perms).toContainEqual({ resource: 'quote', action: 'manage_assignment', scope: 'all' });
    expect(perms.some((p) => p.resource === 'role')).toBe(false);
    expect(template(ROLES.MEMBER).permissions).toEqual([]);
  });
});
