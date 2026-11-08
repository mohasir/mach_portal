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

const canReschedule = (role: string) =>
  templateCan(role, { [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] });

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
    expect(templateCan(ROLES.SUPERADMIN, viewReschedules)).toBe(true);
    expect(templateCan(ROLES.ADMIN, viewReschedules)).toBe(true);
    expect(templateCan(ROLES.OPERATOR, viewReschedules)).toBe(true);
  });

  it('only superadmin sees the reschedule reasons catalog page', () => {
    const view = { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.VIEW] };
    expect(templateCan(ROLES.SUPERADMIN, view)).toBe(true);
    expect(templateCan(ROLES.ADMIN, view)).toBe(false);
    expect(templateCan(ROLES.OPERATOR, view)).toBe(false);
  });

  it('admin can read reasons to pick one, but not manage them', () => {
    expect(templateCan(ROLES.ADMIN, { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.READ] })).toBe(true);
    expect(templateCan(ROLES.ADMIN, { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.CREATE] })).toBe(
      false,
    );
    expect(templateCan(ROLES.OPERATOR, { [RESOURCES.RESCHEDULE_REASON]: [ACTIONS.READ] })).toBe(
      false,
    );
  });
});
