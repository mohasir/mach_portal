import {
  ACTIONS,
  RESOURCES,
  ROLES,
  type ActionType,
  type ResourceType,
  type RoleType,
} from '../constants/index';

export type RolePermissions = Partial<Record<ResourceType, ActionType[]>>;

export type RolesPermissionsMatrixItem = {
  role: RoleType;
  permissions: RolePermissions;
};

const { CREATE, READ, UPDATE, DELETE } = ACTIONS;
const CRUD: ActionType[] = [CREATE, READ, UPDATE, DELETE];

export const rolesPermissionsMatrix = [
  {
    role: ROLES.SUPERADMIN,
    permissions: {
      [RESOURCES.DASHBOARD]: CRUD,
      [RESOURCES.EVENT]: CRUD,
      [RESOURCES.CLIENT]: CRUD,
      [RESOURCES.QUOTE]: CRUD,
      [RESOURCES.PIPELINE]: CRUD,
    },
  },
  {
    role: ROLES.ADMIN,
    permissions: {
      [RESOURCES.DASHBOARD]: CRUD,
      [RESOURCES.EVENT]: CRUD,
      [RESOURCES.CLIENT]: CRUD,
      [RESOURCES.QUOTE]: CRUD,
      [RESOURCES.PIPELINE]: CRUD,
    },
  },
  {
    role: ROLES.MEMBER,
    permissions: {},
  },
] satisfies readonly RolesPermissionsMatrixItem[];
