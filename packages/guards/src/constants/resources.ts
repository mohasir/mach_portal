export const RESOURCES = {
  DASHBOARD: 'dashboard',
  EVENT: 'event',
  CLIENT: 'client',
  QUOTE: 'quote',
  PIPELINE: 'pipeline',
  NOTE: 'note',
} as const;

export type ResourceType = (typeof RESOURCES)[keyof typeof RESOURCES];
export type ResourceKeyType = keyof typeof RESOURCES;
