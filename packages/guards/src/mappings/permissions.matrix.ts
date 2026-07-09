import { ACTIONS, RESOURCES, type ActionType, type ResourceType } from '../constants/index';

export type PermissionsMatrixItem = {
  resource: ResourceType;
  actions: readonly ActionType[];
};

const { CREATE, READ, UPDATE, DELETE } = ACTIONS;

export const permissionsMatrix = [
  {
    resource: RESOURCES.NOTE,
    actions: [CREATE, READ, UPDATE, DELETE]
  },
] as const satisfies readonly PermissionsMatrixItem[];
