import { ACTIONS, RESOURCES, type ActionType, type ResourceType } from '../constants/index';

export type PermissionsMatrixItem = {
  resource: ResourceType;
  actions: readonly ActionType[];
};

const { CREATE, READ, UPDATE, DELETE, VIEW } = ACTIONS;
const CRUD = [CREATE, READ, UPDATE, DELETE] as const;
// Settings resources are singleton rows or fixed catalogs — no create/delete.
// `view` (not `read`) gates whether the section shows up in the FE — the
// underlying data is read unconditionally at the code level where the app
// needs it (see config.router.ts's `get`).
const VIEW_UPDATE = [VIEW, UPDATE] as const;

export const permissionsMatrix = [
  { resource: RESOURCES.DASHBOARD, actions: CRUD },
  { resource: RESOURCES.EVENT, actions: [...CRUD, ACTIONS.UPLOAD_ATTACHMENT] },
  { resource: RESOURCES.CLIENT, actions: CRUD },
  { resource: RESOURCES.QUOTE, actions: CRUD },
  { resource: RESOURCES.PIPELINE, actions: CRUD },
  { resource: RESOURCES.STAFF, actions: CRUD },
  { resource: RESOURCES.PRODUCT, actions: CRUD },
  { resource: RESOURCES.EVENT_TYPE, actions: CRUD },
  { resource: RESOURCES.TAX_RATES, actions: VIEW_UPDATE },
  { resource: RESOURCES.QUOTE_DEFAULTS, actions: VIEW_UPDATE },
  { resource: RESOURCES.QUOTE_STAGES, actions: VIEW_UPDATE },
  { resource: RESOURCES.CATALOG_PREFERENCES, actions: VIEW_UPDATE },
  { resource: RESOURCES.QUOTE_PDF_TEMPLATE, actions: VIEW_UPDATE },
] as const satisfies readonly PermissionsMatrixItem[];
