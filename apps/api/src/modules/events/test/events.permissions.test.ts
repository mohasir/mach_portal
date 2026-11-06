import { describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES, ROLES, hasPermission } from '@repo/guards';

const canReschedule = (role: string) =>
  hasPermission(role, { [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] });

describe('reschedule permissions', () => {
  it('superadmin and admin can reschedule events', () => {
    expect(canReschedule(ROLES.SUPERADMIN)).toBe(true);
    expect(canReschedule(ROLES.ADMIN)).toBe(true);
  });

  it('operator cannot reschedule, not even own-scoped events', () => {
    expect(canReschedule(ROLES.OPERATOR)).toBe(false);
  });

  it('every role with event access can view the reschedule history', () => {
    const viewReschedules = { [RESOURCES.EVENT]: [ACTIONS.VIEW_RESCHEDULES] };
    expect(hasPermission(ROLES.SUPERADMIN, viewReschedules)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, viewReschedules)).toBe(true);
    expect(hasPermission(ROLES.OPERATOR, viewReschedules)).toBe(true);
  });

  it('only superadmin sees the reschedule reasons catalog page', () => {
    const view = { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.VIEW] };
    expect(hasPermission(ROLES.SUPERADMIN, view)).toBe(true);
    expect(hasPermission(ROLES.ADMIN, view)).toBe(false);
    expect(hasPermission(ROLES.OPERATOR, view)).toBe(false);
  });

  it('admin can read reasons to pick one, but not manage them', () => {
    expect(hasPermission(ROLES.ADMIN, { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.READ] })).toBe(
      true,
    );
    expect(hasPermission(ROLES.ADMIN, { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.CREATE] })).toBe(
      false,
    );
    expect(hasPermission(ROLES.OPERATOR, { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.READ] })).toBe(
      false,
    );
  });
});
