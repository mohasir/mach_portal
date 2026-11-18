import { FEATURES, FEATURE_KEYS, isToggleable, type FeatureKey } from '@repo/guards';
import type { SetConsoleFeatureInput } from '@repo/schemas';
import type { Locale } from '@/lib/i18n/config';
import { formatMoney, fromMajorUnit, toMajorUnit } from '@/lib/utils/money';

export function resolveConsoleAccess({
  isPending,
  isPlatformAdmin,
}: {
  isPending: boolean;
  isPlatformAdmin: boolean;
}): 'loading' | 'allow' | 'notFound' {
  if (isPending) return 'loading';
  return isPlatformAdmin ? 'allow' : 'notFound';
}

export interface FeatureToggleState {
  canEnable: boolean;
  canDisable: boolean;
  /** Required features that are not active. */
  missing: FeatureKey[];
  /** Active features that require this one. */
  blockedBy: FeatureKey[];
}

export function featureToggleState(
  key: FeatureKey,
  activeKeys: ReadonlySet<FeatureKey>,
  enabledDependents: readonly FeatureKey[],
): FeatureToggleState {
  const missing = (FEATURES[key].requires as readonly FeatureKey[]).filter(
    (dep) => !activeKeys.has(dep),
  );
  const blockedBy = [...enabledDependents];
  return {
    canEnable: missing.length === 0,
    canDisable: blockedBy.length === 0,
    missing,
    blockedBy,
  };
}

/**
 * Dependents the API counts when disabling `key`: enabled and not expired on the stored rows,
 * regardless of whether their own requirements currently resolve.
 */
export function liveDependentsOf(
  key: FeatureKey,
  features: readonly { key: FeatureKey; enabled: boolean; expiresAt: string | null }[],
  now: number,
): FeatureKey[] {
  return features
    .filter(
      (f) =>
        f.enabled &&
        (f.expiresAt === null || Date.parse(f.expiresAt) > now) &&
        (FEATURES[f.key].requires as readonly string[]).includes(key),
    )
    .map((f) => f.key);
}

export interface FeatureFormValues {
  /** Last active day, 'YYYY-MM-DD'. */
  expiresOn: string | null;
  /** Major units with two decimals. */
  price: number | null;
  billingPeriod: 'monthly' | 'yearly' | null;
  currency: string | null;
}

interface StoredFeatureTerms {
  expiresAt: string | null;
  priceCents: number | null;
  billingPeriod: string | null;
  currency: string | null;
}

const DAY_MS = 86_400_000;

// The API stores the start of the day after the last active one, in UTC.
export function lastActiveDay(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  return new Date(Date.parse(expiresAt) - DAY_MS).toISOString().slice(0, 10);
}

export function toFeatureFormValues(feature: StoredFeatureTerms): FeatureFormValues {
  return {
    expiresOn: lastActiveDay(feature.expiresAt),
    price: feature.priceCents === null ? null : toMajorUnit(feature.priceCents),
    billingPeriod:
      feature.billingPeriod === 'monthly' || feature.billingPeriod === 'yearly'
        ? feature.billingPeriod
        : null,
    currency: feature.currency,
  };
}

export const isValidCurrency = (value: string) => /^[A-Za-z]{3}$/.test(value.trim());

const normalizeCurrency = (value: string | null) => {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed : null;
};

/** Only the fields the user changed: an absent field keeps the stored value, null clears it. */
export function buildFeatureSetInput(
  initial: FeatureFormValues,
  next: FeatureFormValues,
): Omit<SetConsoleFeatureInput, 'organizationId' | 'key'> {
  const input: Omit<SetConsoleFeatureInput, 'organizationId' | 'key'> = {};
  if (next.expiresOn !== initial.expiresOn) input.expiresOn = next.expiresOn;
  if (next.price !== initial.price) {
    input.priceCents = next.price === null ? null : fromMajorUnit(next.price);
  }
  if (next.billingPeriod !== initial.billingPeriod) input.billingPeriod = next.billingPeriod;
  const currency = normalizeCurrency(next.currency);
  if (currency !== normalizeCurrency(initial.currency)) input.currency = currency;
  return input;
}

export const slugErrorCodes: readonly string[] = ['TENANT_SLUG_TAKEN', 'TENANT_INVALID_SLUG'];

const DEPENDENCY_ERROR_CODES: readonly string[] = [
  'FEATURE_MISSING_DEPENDENCY',
  'FEATURE_HAS_DEPENDENTS',
];

export const isDependencyErrorCode = (code: string | undefined): code is string =>
  !!code && DEPENDENCY_ERROR_CODES.includes(code);

export interface HistoryDetailParts {
  featureKey?: string;
  path?: string;
  catalogKind?: string;
}

const asString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

/** The few fields of a history `detail` worth showing; the rest of the payload stays out of the UI. */
export function historyDetailParts(detail: Record<string, unknown> | null): HistoryDetailParts {
  if (!detail) return {};
  const parts: HistoryDetailParts = {};
  const featureKey = asString(detail.featureKey) ?? asString(detail.key);
  if (featureKey) parts.featureKey = featureKey;
  const path = asString(detail.path);
  if (path) parts.path = path;
  const catalogKind = asString(detail.kind);
  if (catalogKind) parts.catalogKind = catalogKind;
  return parts;
}

/** Keys in force: the active toggleable features plus the core ones, which are always on. */
export function activeKeySet(features: readonly { key: FeatureKey; active: boolean }[]) {
  const keys = new Set<FeatureKey>(FEATURE_KEYS.filter((key) => !isToggleable(key)));
  for (const feature of features) if (feature.active) keys.add(feature.key);
  return keys;
}

export const formatFeaturePrice = (cents: number, currency: string | null, locale: Locale) =>
  currency ? formatMoney(cents, locale, currency) : toMajorUnit(cents).toFixed(2);
