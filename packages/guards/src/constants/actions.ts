export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  DISABLE: 'disable',
  ENABLE: 'enable',
  UPLOAD_ATTACHMENT: 'upload_attachment',
  VIEW: 'view',
  MANAGE_SELECTIONS: 'manage_selections',
  VIEW_SUMMARY: 'view_summary',
  VIEW_QUOTES_CHART: 'view_quotes_chart',
  VIEW_TOP_PRODUCTS: 'view_top_products',
} as const;

export type ActionType = (typeof ACTIONS)[keyof typeof ACTIONS];
export type ActionKeyType = keyof typeof ACTIONS;
