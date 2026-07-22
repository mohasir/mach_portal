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

const { CREATE, READ, UPDATE, DELETE, UPLOAD_ATTACHMENT, VIEW } = ACTIONS;

const CRUD = [CREATE, READ, UPDATE, DELETE];
const READ_ONLY = [READ];
const VIEW_UPDATE = [VIEW, UPDATE];
const VIEW_ONLY = [VIEW];

const EVENT_CRUD_WITH_UPLOAD = [...CRUD, UPLOAD_ATTACHMENT];
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
      [RESOURCES.TAX_RATES]: VIEW_UPDATE,
      [RESOURCES.QUOTE_DEFAULTS]: VIEW_UPDATE,
      [RESOURCES.QUOTE_STAGES]: VIEW_UPDATE,
      [RESOURCES.CATALOG_PREFERENCES]: VIEW_UPDATE,
      [RESOURCES.QUOTE_PDF_TEMPLATE]: VIEW_UPDATE,
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
      [RESOURCES.TAX_RATES]: VIEW_UPDATE,
      [RESOURCES.QUOTE_DEFAULTS]: VIEW_UPDATE,
      // [RESOURCES.QUOTE_STAGES]: VIEW_ONLY,
      // [RESOURCES.CATALOG_PREFERENCES]: VIEW_ONLY,
      [RESOURCES.QUOTE_PDF_TEMPLATE]: VIEW_UPDATE,
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
      /* [RESOURCES.TAX_RATES]: VIEW_ONLY,
      [RESOURCES.QUOTE_DEFAULTS]: VIEW_ONLY,
      [RESOURCES.QUOTE_STAGES]: VIEW_ONLY,
      [RESOURCES.CATALOG_PREFERENCES]: VIEW_ONLY,
      [RESOURCES.QUOTE_PDF_TEMPLATE]: VIEW_ONLY, */
    },
  },
  {
    role: ROLES.MEMBER,
    permissions: {},
  },
] satisfies readonly RolesPermissionsMatrixItem[];
