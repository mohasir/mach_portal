import { ACTIONS, RESOURCES, type ActionType, type ResourceType } from '../constants/index';

export type PermissionsMatrixItem = {
  resource: ResourceType;
  actions: readonly ActionType[];
};

const { CREATE, READ, UPDATE, DELETE } = ACTIONS;
const CRUD = [CREATE, READ, UPDATE, DELETE] as const;

export const permissionsMatrix = [
  { resource: RESOURCES.DASHBOARD, actions: CRUD },
  { resource: RESOURCES.EVENT, actions: CRUD },
  { resource: RESOURCES.CLIENT, actions: CRUD },
  { resource: RESOURCES.QUOTE, actions: CRUD },
  { resource: RESOURCES.PIPELINE, actions: CRUD },
  { resource: RESOURCES.NOTE, actions: CRUD },
] as const satisfies readonly PermissionsMatrixItem[];
