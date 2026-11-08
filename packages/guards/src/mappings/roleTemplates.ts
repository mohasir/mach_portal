import { ROLES, type RoleType } from '../constants/index';
import { rolesPermissionsMatrix, type ResourceScope } from './rolesPermissions.matrix';

export type RoleTemplatePermission = {
  resource: string;
  action: string;
  scope: ResourceScope;
};

export type RoleTemplate = {
  key: RoleType;
  name: string;
  isOwner: boolean;
  permissions: RoleTemplatePermission[];
};

const NAMES: Record<RoleType, string> = {
  [ROLES.SUPERADMIN]: 'Superadmin',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.OPERATOR]: 'Operator',
  [ROLES.MEMBER]: 'Member',
};

export const ROLE_TEMPLATES: readonly RoleTemplate[] = rolesPermissionsMatrix.map(
  ({ role, permissions }) => {
    const isOwner = role === ROLES.SUPERADMIN;
    return {
      key: role,
      name: NAMES[role],
      isOwner,
      // The owner's power is the isOwner bypass in can/scopeFor, never stored rows.
      permissions: isOwner
        ? []
        : Object.entries(permissions).flatMap(([resource, grant]) => {
            const actions: string[] = Array.isArray(grant) ? grant : grant.actions;
            const scope: ResourceScope = Array.isArray(grant) ? 'all' : grant.scope;
            return actions.map((action) => ({ resource, action, scope }));
          }),
    };
  },
);
