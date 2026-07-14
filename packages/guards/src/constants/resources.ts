export const RESOURCES = {
  DASHBOARD: 'dashboard',
  EVENT: 'event',
  CLIENT: 'client',
  QUOTE: 'quote',
  PIPELINE: 'pipeline',
  STAFF: 'staff',
  PRODUCT: 'product',
  EVENT_TYPE: 'event_type',
  CONFIG: 'config',
} as const;

export type ResourceType = (typeof RESOURCES)[keyof typeof RESOURCES];
export type ResourceKeyType = keyof typeof RESOURCES;
