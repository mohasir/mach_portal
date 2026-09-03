import { ACTIONS, RESOURCES, ROLES, type RoleType } from '../constants/index';
import { permissionsMatrix } from './permissions.matrix';

// 'own' = row-level scoping (createdBy/assignedTo) applies when reading/writing that
// resource; 'all' = unrestricted, the default when a plain actions array is given.
export type ResourceScope = 'own' | 'all';

// A resource grant is either a plain actions array (implicit scope 'all', the common
// case) or an explicit { actions, scope } — lets one role mix scopes per resource
// (ej. QUOTE: 'own' pero PIPELINE: 'all' en el mismo rol).
export type ResourceGrant<Action> = Action[] | { actions: Action[]; scope: ResourceScope };

// Derived from `permissionsMatrix` (same pattern as `domainStatements` in
// core/access-control.ts) so each resource's array type is pinned to exactly the
// actions declared for THAT resource — not the full cross-resource action union.
// Without this, granting `upload_attachment` on `event` would widen every other
// resource's allowed values too, and better-auth's `ac.newRole()` rejects that.
export type RolePermissions = Partial<{
  [Item in (typeof permissionsMatrix)[number] as Item['resource']]: ResourceGrant<
    Item['actions'][number]
  >;
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
  MANAGE_LINE_PRICING,
  MANAGE_STAFF_ASSIGNMENTS,
  MANAGE_ASSIGNMENT,
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

const PAYMENT_FULL = [CREATE, READ, DELETE, UPLOAD_ATTACHMENT];
const EVENT_FULL = [...CRUD, MANAGE_SELECTIONS, MANAGE_STAFF_ASSIGNMENTS];
const DASHBOARD_FULL = [READ, VIEW_SUMMARY, VIEW_QUOTES_CHART, VIEW_TOP_PRODUCTS];
// Only admin/superadmin can override a quote line's numPersons/price away from the
// catalog's price tiers, or reassign a quote to another user — operator (scope 'own')
// stays plain CRUD.
const QUOTE_FULL = [...CRUD, MANAGE_LINE_PRICING, MANAGE_ASSIGNMENT];

export const rolesPermissionsMatrix = [
  {
    role: ROLES.SUPERADMIN,
    permissions: {
      [RESOURCES.DASHBOARD]: DASHBOARD_FULL,
      [RESOURCES.EVENT]: EVENT_FULL,
      [RESOURCES.PAYMENT]: PAYMENT_FULL,
      [RESOURCES.CLIENT]: CRUD,
      [RESOURCES.QUOTE]: QUOTE_FULL,
      [RESOURCES.PIPELINE]: CRUD,
      [RESOURCES.STAFF]: CRUD,
      [RESOURCES.PRODUCT]: PRODUCT_FULL,
      [RESOURCES.PRICE_TIERS]: CRUD,
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
      [RESOURCES.QUOTE]: QUOTE_FULL,
      [RESOURCES.PIPELINE]: CRUD,
      [RESOURCES.STAFF]: CRUD,
      [RESOURCES.PRODUCT]: PRODUCT_ADMIN,
      [RESOURCES.PRICE_TIERS]: CRUD,
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
    role: ROLES.OPERATOR,
    permissions: {
      [RESOURCES.EVENT]: { actions: [READ, MANAGE_STAFF_ASSIGNMENTS], scope: 'own' },
      [RESOURCES.CLIENT]: CRUD,
      [RESOURCES.QUOTE]: { actions: CRUD, scope: 'own' },
      [RESOURCES.PIPELINE]: CRUD,
      [RESOURCES.PRODUCT]: READ_ONLY,
      [RESOURCES.EVENT_TYPE]: READ_ONLY,
      [RESOURCES.STAFF]: READ_ONLY,
    },
  },
  {
    role: ROLES.MEMBER,
    permissions: {},
  },
] satisfies readonly RolesPermissionsMatrixItem[];
