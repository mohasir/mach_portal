import { ACTIONS, RESOURCES, ROLES, type RoleType } from '../constants/index';
import { permissionsMatrix } from './permissions.matrix';

// Derived from `permissionsMatrix` (same pattern as `domainStatements` in
// core/access-control.ts) so each resource's array type is pinned to exactly the
// actions declared for THAT resource — not the full cross-resource action union.
// Without this, granting `upload_attachment` on `event` would widen every other
// resource's allowed values too, and better-auth's `ac.newRole()` rejects that.
export type RolePermissions = Partial<{
  [Item in (typeof permissionsMatrix)[number] as Item['resource']]: Item['actions'][number][];
}>;

export type RolesPermissionsMatrixItem = {
  role: RoleType;
  permissions: RolePermissions;
};

const { CREATE, READ, UPDATE, DELETE, UPLOAD_ATTACHMENT } = ACTIONS;
// No explicit `ActionType[]` annotation here — that would widen these to the full
// action union and break assignability against each resource's own narrower
// action set (e.g. `dashboard` only ever declares CRUD, never upload_attachment).
const CRUD = [CREATE, READ, UPDATE, DELETE];
const READ_ONLY = [READ];
// Full event access plus attachment uploads, for roles that manage events end-to-end.
const EVENT_CRUD_WITH_UPLOAD = [...CRUD, UPLOAD_ATTACHMENT];
// Read-only on events, but can still upload payment receipts (e.g. a manager
// handling collections without full edit rights on the event itself).
const EVENT_READ_WITH_UPLOAD = [...READ_ONLY, UPLOAD_ATTACHMENT];

export const rolesPermissionsMatrix = [
  {
    role: ROLES.SUPERADMIN,
    permissions: {
      [RESOURCES.DASHBOARD]: CRUD,
      [RESOURCES.EVENT]: EVENT_CRUD_WITH_UPLOAD,
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
      [RESOURCES.EVENT]: EVENT_CRUD_WITH_UPLOAD,
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
      [RESOURCES.EVENT]: EVENT_READ_WITH_UPLOAD,
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
