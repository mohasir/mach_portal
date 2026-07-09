import { ACTIONS, RESOURCES, ROLES, type ActionType, type ResourceType, type RoleType } from '../constants/index';

export type RolePermissions = Partial<Record<ResourceType, ActionType[]>>;

export type RolesPermissionsMatrixItem = {
  role: RoleType;
  permissions: RolePermissions;
};

const { CREATE, READ, UPDATE, DELETE } = ACTIONS;

export const rolesPermissionsMatrix = [
  {
    role: ROLES.SUPERADMIN,
    permissions: {
      [RESOURCES.NOTE]: [CREATE, READ, UPDATE, DELETE]
    },
  },
  {
    role: ROLES.ADMIN,
    permissions: {
      [RESOURCES.NOTE]: [CREATE, READ, UPDATE, DELETE]
    },
  },
  {
    role: ROLES.MEMBER,
    permissions: {
      [RESOURCES.NOTE]: [READ, UPDATE, DELETE]
    },
  },
] satisfies readonly RolesPermissionsMatrixItem[];
