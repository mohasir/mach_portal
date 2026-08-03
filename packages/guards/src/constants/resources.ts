export const RESOURCES = {
  DASHBOARD: 'dashboard',
  EVENT: 'event',
  PAYMENT: 'payment',
  CLIENT: 'client',
  QUOTE: 'quote',
  PIPELINE: 'pipeline',
  STAFF: 'staff',
  PRODUCT: 'product',
  EVENT_TYPE: 'event_type',
  TAX_RATES: 'tax_rates',
  QUOTE_DEFAULTS: 'quote_defaults',
  QUOTE_STAGES: 'quote_stages',
  CATALOG_PREFERENCES: 'catalog_preferences',
  QUOTE_PDF_TEMPLATE: 'quote_pdf_template',
} as const;

export type ResourceType = (typeof RESOURCES)[keyof typeof RESOURCES];
export type ResourceKeyType = keyof typeof RESOURCES;
