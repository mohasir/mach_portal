import { describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES, ROLES, hasPermission } from '@repo/guards';

const canDuplicate = (role: string) =>
  hasPermission(role, { [RESOURCES.PRODUCT]: [ACTIONS.DUPLICATE] });

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
    hasPermission(role, { [RESOURCES.PRODUCT_OPTION]: [ACTIONS.DELETE] });

  it('superadmin and admin can permanently delete groups and options', () => {
    expect(canDeleteOption(ROLES.SUPERADMIN)).toBe(true);
    expect(canDeleteOption(ROLES.ADMIN)).toBe(true);
  });

  it('operator cannot', () => {
    expect(canDeleteOption(ROLES.OPERATOR)).toBe(false);
  });
});
