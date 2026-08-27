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

const {
  CREATE,
  READ,
  UPDATE,
  DELETE,
  DISABLE,
  ENABLE,
  UPLOAD_ATTACHMENT,
  VIEW,
  MANAGE_SELECTIONS,
  VIEW_SUMMARY,
  VIEW_QUOTES_CHART,
  VIEW_TOP_PRODUCTS,
} = ACTIONS;

const CRUD = [CREATE, READ, UPDATE, DELETE];
// Superadmin gets both DISABLE and ENABLE; admin can disable but not re-enable
// (a soft-deleted product/section/item needs superadmin to bring back).
const PRODUCT_FULL = [...CRUD, DISABLE, ENABLE];
const PRODUCT_ADMIN = [...CRUD, DISABLE];
const READ_ONLY = [READ];
const VIEW_UPDATE = [VIEW, UPDATE];
const VIEW_ONLY = [VIEW];

const PAYMENT_FULL = [CREATE, READ, DELETE, UPLOAD_ATTACHMENT];
const EVENT_FULL = [...CRUD, MANAGE_SELECTIONS];
const DASHBOARD_FULL = [READ, VIEW_SUMMARY, VIEW_QUOTES_CHART, VIEW_TOP_PRODUCTS];

export const rolesPermissionsMatrix = [
  {
    role: ROLES.SUPERADMIN,
    permissions: {
      [RESOURCES.DASHBOARD]: DASHBOARD_FULL,
      [RESOURCES.EVENT]: EVENT_FULL,
      [RESOURCES.PAYMENT]: PAYMENT_FULL,
      [RESOURCES.CLIENT]: CRUD,
      [RESOURCES.QUOTE]: CRUD,
      [RESOURCES.PIPELINE]: CRUD,
      [RESOURCES.STAFF]: CRUD,
      [RESOURCES.PRODUCT]: PRODUCT_FULL,
      [RESOURCES.EVENT_TYPE]: CRUD,
      [RESOURCES.TAX_RATES]: VIEW_UPDATE,
      [RESOURCES.QUOTE_DEFAULTS]: VIEW_UPDATE,
      [RESOURCES.QUOTE_STAGES]: VIEW_UPDATE,
      [RESOURCES.CATALOG_PREFERENCES]: VIEW_UPDATE,
      [RESOURCES.QUOTE_PDF_TEMPLATE]: VIEW_UPDATE,
      [RESOURCES.QUOTE_BUILDER_PREFERENCES]: VIEW_UPDATE,
    },
  },
  {
    role: ROLES.ADMIN,
    permissions: {
      [RESOURCES.DASHBOARD]: DASHBOARD_FULL,
      [RESOURCES.EVENT]: EVENT_FULL,
      [RESOURCES.PAYMENT]: PAYMENT_FULL,
      [RESOURCES.CLIENT]: CRUD,
      [RESOURCES.QUOTE]: CRUD,
      [RESOURCES.PIPELINE]: CRUD,
      [RESOURCES.STAFF]: CRUD,
      [RESOURCES.PRODUCT]: PRODUCT_ADMIN,
      [RESOURCES.EVENT_TYPE]: CRUD,
      [RESOURCES.TAX_RATES]: VIEW_UPDATE,
      [RESOURCES.QUOTE_DEFAULTS]: VIEW_UPDATE,
      // [RESOURCES.QUOTE_STAGES]: VIEW_ONLY,
      // [RESOURCES.CATALOG_PREFERENCES]: VIEW_ONLY,
      [RESOURCES.QUOTE_PDF_TEMPLATE]: VIEW_UPDATE,
      // [RESOURCES.QUOTE_BUILDER_PREFERENCES]: VIEW_ONLY,
    },
  },
  {
    role: ROLES.MANAGER,
    permissions: {
      [RESOURCES.DASHBOARD]: DASHBOARD_FULL,
      [RESOURCES.EVENT]: READ_ONLY,
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
