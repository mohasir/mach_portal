import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  RESOURCES,
  ROLES,
  ROLE_TEMPLATES,
  can,
  permissionKey,
  type AccessGrants,
  type PermissionCheck,
} from '@repo/guards';

// Checks the seeded base role with the same evaluator the API uses at request time.
function templateCan(role: string, check: PermissionCheck): boolean {
  const template = ROLE_TEMPLATES.find((t) => t.key === role)!;
  const access: AccessGrants = {
    isOwner: template.isOwner,
    grants: Object.fromEntries(
      template.permissions.map((p) => [permissionKey(p.resource, p.action), p.scope]),
    ),
  };
  return can(access, check);
}

const canDuplicate = (role: string) =>
  templateCan(role, { [RESOURCES.PRODUCT]: [ACTIONS.DUPLICATE] });

describe('product duplicate permission', () => {
  it('superadmin and admin can duplicate products', () => {
    expect(canDuplicate(ROLES.SUPERADMIN)).toBe(true);
    expect(canDuplicate(ROLES.ADMIN)).toBe(true);
  });

  it('operator cannot duplicate products', () => {
    expect(canDuplicate(ROLES.OPERATOR)).toBe(false);
  });
});

describe('product option delete permission', () => {
  const canDeleteOption = (role: string) =>
    templateCan(role, { [RESOURCES.PRODUCT_OPTION]: [ACTIONS.DELETE] });

  it('superadmin and admin can permanently delete groups and options', () => {
    expect(canDeleteOption(ROLES.SUPERADMIN)).toBe(true);
    expect(canDeleteOption(ROLES.ADMIN)).toBe(true);
  });

  it('operator cannot', () => {
    expect(canDeleteOption(ROLES.OPERATOR)).toBe(false);
  });
});
