import { normalizeChargeValue, type ChargeKind, type CreateChargeTypeInput } from '@repo/schemas';
import { toDisplayPercent } from '@/lib/utils/percent';

/** One field per kind, so switching the kind in the form never reinterprets a typed number. */
export interface ChargeTypeFormValues {
  name?: string;
  kind: ChargeKind;
  /** Cents. */
  fixedValue?: number | null;
  /** Rate 0..1. */
  percentValue?: number | null;
}

interface ChargeTypeLike {
  name: string;
  kind: ChargeKind;
  defaultValue: number;
}

export function toChargeTypeFormValues(type?: ChargeTypeLike): ChargeTypeFormValues {
  if (!type) return { kind: 'fixed', fixedValue: 0 };
  return type.kind === 'percent'
    ? { name: type.name, kind: 'percent', percentValue: type.defaultValue }
    : { name: type.name, kind: 'fixed', fixedValue: type.defaultValue };
}

export function toChargeTypeInput(values: ChargeTypeFormValues): CreateChargeTypeInput {
  const raw = (values.kind === 'percent' ? values.percentValue : values.fixedValue) ?? 0;
  return {
    name: (values.name ?? '').trim(),
    kind: values.kind,
    defaultValue: normalizeChargeValue(values.kind, raw),
  };
}

export const formatChargeValue = (
  type: Pick<ChargeTypeLike, 'kind' | 'defaultValue'>,
  money: (cents: number) => string,
): string =>
  type.kind === 'percent' ? `${toDisplayPercent(type.defaultValue)}%` : money(type.defaultValue);
