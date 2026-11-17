import { RESOURCES, type ResourceType } from '../constants/resources';
import type { FeatureKey } from './registry';

export const RESOURCE_MODULE: Partial<Record<ResourceType, FeatureKey>> = {
  [RESOURCES.QUOTE]: 'quotes',
  [RESOURCES.PIPELINE]: 'quotes',
  [RESOURCES.QUOTE_DEFAULTS]: 'quotes',
  [RESOURCES.QUOTE_STAGES]: 'quotes',
  [RESOURCES.QUOTE_PDF_TEMPLATE]: 'quotes',
  [RESOURCES.QUOTE_BUILDER_PREFERENCES]: 'quotes',
  [RESOURCES.PIPELINE_PREFERENCES]: 'quotes',
  // Charges only exist on quotes; the extraCharges add-on is checked on top of it.
  [RESOURCES.CHARGE_TYPE]: 'quotes',
  [RESOURCES.EVENT]: 'events',
  [RESOURCES.PAYMENT]: 'events',
  [RESOURCES.STAFF]: 'events',
  [RESOURCES.EVENT_TYPE]: 'events',
  [RESOURCES.RESCHEDULE_REASON]: 'events',
};

export const moduleOfResource = (resource: string): FeatureKey | undefined =>
  (RESOURCE_MODULE as Partial<Record<string, FeatureKey>>)[resource];
