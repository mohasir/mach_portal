import { describe, expect, it } from 'vitest';
import esUsers from '@/locales/es/users.json';
import enUsers from '@/locales/en/users.json';
import { describeRole, roleLabel } from '../roleLabel';

const t = (key: string) => `t:${key}`;

describe('describeRole', () => {
  it('labels the owner role by its translation whatever it is called', () => {
    expect(describeRole({ name: 'Dirección', isOwner: true })).toEqual({
      labelKey: 'roles.owner',
      color: 'gold',
    });
    expect(roleLabel({ name: 'Dirección', isOwner: true }, t)).toBe('t:roles.owner');
  });

  it('translates the seeded system roles while they keep their seeded name', () => {
    expect(describeRole({ name: 'Admin', isOwner: false }).labelKey).toBe('roles.admin');
    expect(describeRole({ name: 'Operator', isOwner: false }).labelKey).toBe('roles.operator');
    expect(roleLabel({ name: 'Member', isOwner: false }, t)).toBe('t:roles.member');
  });

  it('shows a custom or renamed role by its stored name, untranslated', () => {
    expect(describeRole({ name: 'Ventas', isOwner: false })).toEqual({
      labelKey: null,
      color: 'default',
    });
    expect(roleLabel({ name: 'Ventas', isOwner: false }, t)).toBe('Ventas');
  });

  it('does not treat the owner template name as a system role on a non-owner role', () => {
    expect(describeRole({ name: 'Superadmin', isOwner: false }).labelKey).toBeNull();
  });

  it.each([
    ['es', esUsers],
    ['en', enUsers],
  ])('has %s translations for every key it can return', (_locale, users) => {
    const roles = users.roles as Record<string, string>;
    for (const role of [
      { name: 'x', isOwner: true },
      { name: 'Admin', isOwner: false },
      { name: 'Operator', isOwner: false },
      { name: 'Member', isOwner: false },
    ]) {
      const key = describeRole(role).labelKey!.replace('roles.', '');
      expect(roles[key], key).toBeTruthy();
    }
  });
});
