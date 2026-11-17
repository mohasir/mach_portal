import { describe, expect, it } from 'vitest';
import esUnits from '@/locales/es/unitsOfMeasure.json';
import enUnits from '@/locales/en/unitsOfMeasure.json';
import { factorLabel, groupUnitsByDimension, unitFieldLocks } from '../helpers';

const unit = (code: string, dimension: string, extra: Partial<Record<string, unknown>> = {}) => ({
  id: code,
  code,
  dimension: dimension as 'quantity' | 'time' | 'weight' | 'volume' | 'length',
  factor: '1',
  isBase: false,
  isSystem: false,
  isUsed: false,
  ...extra,
});

describe('unitFieldLocks', () => {
  it('locks nothing on a new unit', () => {
    expect(unitFieldLocks(undefined)).toEqual({ code: false, dimension: false, factor: false });
  });

  it('locks code, dimension and factor of a system unit', () => {
    expect(unitFieldLocks(unit('h', 'time', { isSystem: true }))).toEqual({
      code: true,
      dimension: true,
      factor: true,
    });
  });

  it('locks dimension and factor of an own unit a product uses', () => {
    expect(unitFieldLocks(unit('bdj', 'quantity', { isUsed: true }))).toEqual({
      code: false,
      dimension: true,
      factor: true,
    });
    expect(unitFieldLocks(unit('bdj', 'quantity'))).toEqual({
      code: false,
      dimension: false,
      factor: false,
    });
  });
});

describe('factorLabel', () => {
  it('is empty for a base unit', () => {
    expect(factorLabel(unit('min', 'time', { isBase: true }))).toBeNull();
  });

  it('writes the equivalence in the base unit of the dimension', () => {
    expect(factorLabel(unit('h', 'time', { factor: '60' }))).toBe('60 min');
    expect(factorLabel(unit('lb', 'weight', { factor: '453.59237' }))).toBe('453.59237 g');
    expect(factorLabel(unit('doc', 'quantity', { factor: '12' }))).toBe('12 und');
  });
});

describe('groupUnitsByDimension', () => {
  const units = [
    unit('kg', 'weight'),
    unit('und', 'quantity'),
    unit('h', 'time'),
    unit('pers', 'quantity'),
  ];

  it('groups in the fixed dimension order and keeps the order inside each group', () => {
    expect(
      groupUnitsByDimension(units).map((g) => [g.dimension, g.units.map((u) => u.code)]),
    ).toEqual([
      ['quantity', ['und', 'pers']],
      ['time', ['h']],
      ['weight', ['kg']],
    ]);
  });

  it('adds the current unit when it is not among the options', () => {
    const current = unit('gal', 'volume');
    expect(
      groupUnitsByDimension(units, current).map((g) => [g.dimension, g.units.map((u) => u.code)]),
    ).toContainEqual(['volume', ['gal']]);
    expect(groupUnitsByDimension(units, units[0]).flatMap((g) => g.units)).toHaveLength(4);
  });
});

type Tree = { [key: string]: string | Tree };
const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );

describe('unitsOfMeasure locales', () => {
  it('have the same keys in es and en', () => {
    expect(keys(enUnits).sort()).toEqual(keys(esUnits).sort());
  });
});
