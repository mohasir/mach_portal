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
  MANAGE_LINE_PRICING: 'manage_line_pricing',
  MANAGE_STAFF_ASSIGNMENTS: 'manage_staff_assignments',
  MANAGE_ASSIGNMENT: 'manage_assignment',
  REGENERATE_PDF: 'regenerate_pdf',
  VIEW_SUMMARY: 'view_summary',
  VIEW_QUOTES_CHART: 'view_quotes_chart',
  VIEW_TOP_PRODUCTS: 'view_top_products',
} as const;

export type ActionType = (typeof ACTIONS)[keyof typeof ACTIONS];
export type ActionKeyType = keyof typeof ACTIONS;
