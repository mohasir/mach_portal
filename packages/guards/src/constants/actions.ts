export const ACTIONS = {
  CREATE: 'create',
  READ:   'read',
  UPDATE: 'update',
  DELETE: 'delete',
} as const;

export type ActionType    = (typeof ACTIONS)[keyof typeof ACTIONS];
export type ActionKeyType = keyof typeof ACTIONS;
