import { ACTIONS, RESOURCES, type ActionType, type ResourceType } from '../constants/index';

export type PermissionsMatrixItem = {
  resource: ResourceType;
  actions: readonly ActionType[];
};

const {
  CREATE,
  READ,
  UPDATE,
  DELETE,
  DISABLE,
  ENABLE,
  VIEW,
  MANAGE_SELECTIONS,
  MANAGE_LINE_PRICING,
  MANAGE_STAFF_ASSIGNMENTS,
  MANAGE_ASSIGNMENT,
  VIEW_SUMMARY,
  VIEW_QUOTES_CHART,
  VIEW_TOP_PRODUCTS,
} = ACTIONS;
const CRUD = [CREATE, READ, UPDATE, DELETE] as const;
// Settings resources are singleton rows or fixed catalogs — no create/delete.
// `view` (not `read`) gates whether the section shows up in the FE — the
// underlying data is read unconditionally at the code level where the app
// needs it (see config.router.ts's `get`).
const VIEW_UPDATE = [VIEW, UPDATE] as const;
// `dashboard` is read-only (aggregation queries, no CRUD). `read` still gates
// page-level access (nav item + route-access); the other three gate one
// dashboard block each, independently of one another.
const DASHBOARD_VIEWS = [READ, VIEW_SUMMARY, VIEW_QUOTES_CHART, VIEW_TOP_PRODUCTS] as const;

export const permissionsMatrix = [
  { resource: RESOURCES.DASHBOARD, actions: DASHBOARD_VIEWS },
  { resource: RESOURCES.EVENT, actions: [...CRUD, MANAGE_SELECTIONS, MANAGE_STAFF_ASSIGNMENTS] },
  { resource: RESOURCES.PAYMENT, actions: [CREATE, READ, DELETE, ACTIONS.UPLOAD_ATTACHMENT] },
  { resource: RESOURCES.CLIENT, actions: CRUD },
  { resource: RESOURCES.QUOTE, actions: [...CRUD, MANAGE_LINE_PRICING, MANAGE_ASSIGNMENT] },
  { resource: RESOURCES.PIPELINE, actions: CRUD },
  { resource: RESOURCES.STAFF, actions: CRUD },
  { resource: RESOURCES.PRODUCT, actions: [...CRUD, DISABLE, ENABLE] },
  { resource: RESOURCES.PRICE_TIERS, actions: CRUD },
  { resource: RESOURCES.EVENT_TYPE, actions: CRUD },
  { resource: RESOURCES.TAX_RATES, actions: VIEW_UPDATE },
  { resource: RESOURCES.QUOTE_DEFAULTS, actions: VIEW_UPDATE },
  { resource: RESOURCES.QUOTE_STAGES, actions: VIEW_UPDATE },
  { resource: RESOURCES.CATALOG_PREFERENCES, actions: VIEW_UPDATE },
  { resource: RESOURCES.QUOTE_PDF_TEMPLATE, actions: VIEW_UPDATE },
  { resource: RESOURCES.QUOTE_BUILDER_PREFERENCES, actions: VIEW_UPDATE },
] as const satisfies readonly PermissionsMatrixItem[];
