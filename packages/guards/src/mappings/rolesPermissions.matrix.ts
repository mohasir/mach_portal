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
const READ_ONLY: ActionType[] = [READ];

export const rolesPermissionsMatrix = [
  {
    role: ROLES.SUPERADMIN,
    permissions: {
      [RESOURCES.DASHBOARD]: CRUD,
      [RESOURCES.EVENT]: CRUD,
      [RESOURCES.CLIENT]: CRUD,
      [RESOURCES.QUOTE]: CRUD,
      [RESOURCES.PIPELINE]: CRUD,
      [RESOURCES.STAFF]: CRUD,
      [RESOURCES.PRODUCT]: CRUD,
      [RESOURCES.EVENT_TYPE]: CRUD,
      [RESOURCES.CONFIG]: CRUD,
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
      [RESOURCES.STAFF]: CRUD,
      [RESOURCES.PRODUCT]: CRUD,
      [RESOURCES.EVENT_TYPE]: CRUD,
      [RESOURCES.CONFIG]: CRUD,
    },
  },
  {
    role: ROLES.MANAGER,
    permissions: {
      [RESOURCES.DASHBOARD]: READ_ONLY,
      [RESOURCES.EVENT]: READ_ONLY,
      [RESOURCES.CLIENT]: READ_ONLY,
      [RESOURCES.QUOTE]: READ_ONLY,
      [RESOURCES.PIPELINE]: READ_ONLY,
      [RESOURCES.STAFF]: READ_ONLY,
      [RESOURCES.PRODUCT]: READ_ONLY,
      [RESOURCES.EVENT_TYPE]: READ_ONLY,
      [RESOURCES.CONFIG]: READ_ONLY,
    },
  },
  {
    role: ROLES.MEMBER,
    permissions: {},
  },
] satisfies readonly RolesPermissionsMatrixItem[];
