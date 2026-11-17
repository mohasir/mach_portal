export type FeatureKind = 'core' | 'module' | 'addon';

interface FeatureShape {
  readonly kind: FeatureKind;
  readonly requires: readonly string[];
}

const DEFINITIONS = {
  auth: { kind: 'core', requires: [] },
  users: { kind: 'core', requires: [] },
  roles: { kind: 'core', requires: [] },
  settings: { kind: 'core', requires: [] },
  clients: { kind: 'core', requires: [] },
  catalog: { kind: 'core', requires: [] },
  dashboard: { kind: 'core', requires: [] },
  support: { kind: 'core', requires: [] },
  quotes: { kind: 'module', requires: [] },
  // An event is born from an accepted quote (events.quote_id is NOT NULL).
  events: { kind: 'module', requires: ['quotes'] },
  notifications: { kind: 'module', requires: [] },
  priceTiers: { kind: 'addon', requires: [] },
  configurableOptions: { kind: 'addon', requires: [] },
  productGallery: { kind: 'addon', requires: [] },
  unitsOfMeasure: { kind: 'addon', requires: [] },
} as const satisfies Record<string, FeatureShape>;

export type FeatureKey = keyof typeof DEFINITIONS;

export interface FeatureDefinition {
  readonly kind: FeatureKind;
  readonly requires: readonly FeatureKey[];
}


export const FEATURES: Readonly<Record<FeatureKey, FeatureDefinition>> = DEFINITIONS;

export const FEATURE_KEYS = Object.keys(DEFINITIONS) as [FeatureKey, ...FeatureKey[]];

export const isFeatureKey = (value: unknown): value is FeatureKey =>
  typeof value === 'string' && Object.hasOwn(FEATURES, value);

export const isToggleable = (key: FeatureKey): boolean => FEATURES[key].kind !== 'core';
