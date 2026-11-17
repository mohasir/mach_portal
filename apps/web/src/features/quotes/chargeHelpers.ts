import {
  isValidChargeValue,
  normalizeChargeValue,
  type ChargeKind,
  type QuoteChargeInput,
} from '@repo/schemas';
import { toDisplayPercent } from '@/lib/utils/percent';

/** A charge applied to the quote being built: a copy of its type, with the value in use. */
export interface BuilderCharge {
  /** Null when the type was deleted after the charge was applied. */
  chargeTypeId: string | null;
  name: string;
  kind: ChargeKind;
  /** Cents for a fixed charge, a rate (0..1) for a percent one. */
  value: number;
}

export interface OfferedChargeType {
  id: string;
  name: string;
  kind: ChargeKind;
  defaultValue: number;
}

export function toggleCharge(
  charges: readonly BuilderCharge[],
  type: OfferedChargeType,
  applied: boolean,
): BuilderCharge[] {
  if (!applied) return charges.filter((c) => c.chargeTypeId !== type.id);
  if (charges.some((c) => c.chargeTypeId === type.id)) return [...charges];
  return [
    ...charges,
    { chargeTypeId: type.id, name: type.name, kind: type.kind, value: type.defaultValue },
  ];
}

/** Active types, plus the applied charges whose type is no longer offered so they can be removed. */
export function offerableChargeTypes(
  types: readonly OfferedChargeType[],
  charges: readonly BuilderCharge[],
): OfferedChargeType[] {
  const offered = new Set(types.map((t) => t.id));
  const kept = charges.flatMap((c) =>
    c.chargeTypeId && !offered.has(c.chargeTypeId)
      ? [{ id: c.chargeTypeId, name: c.name, kind: c.kind, defaultValue: c.value }]
      : [],
  );
  return [...types, ...kept];
}

/**
 * A type applied to the quote but no longer offered. Its charge can only be removed: the API keeps
 * it only while its value is unchanged. Unknown until the options have loaded.
 */
export const isRetiredChargeType = (
  chargeTypeId: string,
  activeTypeIds: ReadonlySet<string>,
  optionsLoading: boolean,
): boolean => !optionsLoading && !activeTypeIds.has(chargeTypeId);

// The API stores a percent rate rounded to 5 decimals and prices with that; a rate typed as a
// percent (x / 100) can sit one ulp away from it and move an amount by a cent.
const normalized = (charge: BuilderCharge): BuilderCharge => ({
  ...charge,
  value: normalizeChargeValue(charge.kind, charge.value),
});

// With the add-on on, the API rebuilds the charges from the input and cannot reference a deleted
// type; with it off, it keeps every stored charge whatever the input says.
export const effectiveCharges = (
  charges: readonly BuilderCharge[],
  addonEnabled: boolean,
): BuilderCharge[] =>
  (addonEnabled ? charges.filter((c) => c.chargeTypeId) : [...charges]).map(normalized);

/** The full list must always be sent: omitting it deletes the quote's charges. */
export const chargesToSend = (charges: readonly BuilderCharge[]): QuoteChargeInput[] =>
  charges.flatMap((c) =>
    c.chargeTypeId
      ? [{ chargeTypeId: c.chargeTypeId, value: normalizeChargeValue(c.kind, c.value) }]
      : [],
  );

export const chargeValueError = (charge: Pick<BuilderCharge, 'kind' | 'value'>): boolean =>
  !isValidChargeValue(charge.kind, charge.value);

export const chargeRowLabel = (charge: Pick<BuilderCharge, 'name' | 'kind' | 'value'>): string =>
  charge.kind === 'percent' ? `${charge.name} (${toDisplayPercent(charge.value)}%)` : charge.name;
