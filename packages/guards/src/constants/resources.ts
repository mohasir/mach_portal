export const RESOURCES = {
  DASHBOARD: 'dashboard',
  EVENT: 'event',
  PAYMENT: 'payment',
  CLIENT: 'client',
  QUOTE: 'quote',
  PIPELINE: 'pipeline',
  STAFF: 'staff',
  PRODUCT: 'product',
  PRICE_TIERS: 'price_tiers',
  EVENT_TYPE: 'event_type',
  RESCHEDULE_REASON: 'reschedule_reason',
  TAX_RATES: 'tax_rates',
  QUOTE_DEFAULTS: 'quote_defaults',
  QUOTE_STAGES: 'quote_stages',
  CATALOG_PREFERENCES: 'catalog_preferences',
  QUOTE_PDF_TEMPLATE: 'quote_pdf_template',
  QUOTE_BUILDER_PREFERENCES: 'quote_builder_preferences',
  PIPELINE_PREFERENCES: 'pipeline_preferences',
  RELEASE_NOTES_PREFERENCES: 'release_notes_preferences',
} as const;

export type ResourceType = (typeof RESOURCES)[keyof typeof RESOURCES];
export type ResourceKeyType = keyof typeof RESOURCES;
