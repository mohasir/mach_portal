import { describe, expect, it } from 'vitest';
import { createChargeTypeSchema } from '@repo/schemas';
import esChargeTypes from '@/locales/es/chargeTypes.json';
import enChargeTypes from '@/locales/en/chargeTypes.json';
import { formatChargeValue, toChargeTypeFormValues, toChargeTypeInput } from '../helpers';

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

describe('toChargeTypeFormValues', () => {
  it('starts a new type as a fixed charge', () => {
    expect(toChargeTypeFormValues()).toEqual({ kind: 'fixed', fixedValue: 0 });
  });

  it('loads a fixed type with its cents', () => {
    expect(toChargeTypeFormValues({ name: 'Traslado', kind: 'fixed', defaultValue: 5000 })).toEqual(
      { name: 'Traslado', kind: 'fixed', fixedValue: 5000 },
    );
  });

  it('loads a percent type with its rate', () => {
    expect(
      toChargeTypeFormValues({ name: 'Tarjeta', kind: 'percent', defaultValue: 0.03 }),
    ).toEqual({ name: 'Tarjeta', kind: 'percent', percentValue: 0.03 });
  });
});

describe('toChargeTypeInput', () => {
  it('sends the cents of a fixed type and ignores the other field', () => {
    expect(
      toChargeTypeInput({ name: ' Traslado ', kind: 'fixed', fixedValue: 5000, percentValue: 0.5 }),
    ).toEqual({ name: 'Traslado', kind: 'fixed', defaultValue: 5000 });
  });

  it('sends the rate of a percent type rounded to the 5 decimals the API stores', () => {
    expect(
      toChargeTypeInput({ name: 'Tarjeta', kind: 'percent', percentValue: 8.875 / 100 }),
    ).toEqual({ name: 'Tarjeta', kind: 'percent', defaultValue: 0.08875 });
  });

  it('produces an input the API schema accepts', () => {
    const input = toChargeTypeInput({ name: 'Tarjeta', kind: 'percent', percentValue: 0.03 });
    expect(createChargeTypeSchema.safeParse(input).success).toBe(true);
  });

  it('treats a cleared value as zero', () => {
    expect(toChargeTypeInput({ name: 'A', kind: 'fixed' }).defaultValue).toBe(0);
  });
});

describe('formatChargeValue', () => {
  it('formats cents as money and a rate as a percentage', () => {
    expect(formatChargeValue({ kind: 'fixed', defaultValue: 5000 }, money)).toBe('$50.00');
    expect(formatChargeValue({ kind: 'percent', defaultValue: 0.03 }, money)).toBe('3%');
    expect(formatChargeValue({ kind: 'percent', defaultValue: 0.08875 }, money)).toBe('8.875%');
  });
});

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );

describe('chargeTypes locales', () => {
  it('have the same keys in es and en', () => {
    expect(keys(enChargeTypes).sort()).toEqual(keys(esChargeTypes).sort());
  });
});
