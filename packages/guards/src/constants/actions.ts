export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  UPLOAD_ATTACHMENT: 'upload_attachment',
  VIEW: 'view',
  MANAGE_SELECTIONS: 'manage_selections',
} as const;

export type ActionType = (typeof ACTIONS)[keyof typeof ACTIONS];
export type ActionKeyType = keyof typeof ACTIONS;
