import { describe, expect, it } from 'vitest';
import {
  createUnitSchema,
  isPositiveDecimal,
  normalizeDecimal,
  SYSTEM_UNITS,
  UOM_DIMENSIONS,
  unitsOfMeasureListQuerySchema,
} from '@repo/schemas';
import { uomDimensionEnum } from '../../../db/schema';

const valid = {
  name: 'Bandeja',
  pluralName: 'Bandejas',
  code: 'bdj',
  dimension: 'quantity',
  factor: '6',
};

describe('SYSTEM_UNITS', () => {
  it('holds the 23 initial units with unique codes', () => {
    expect(SYSTEM_UNITS).toHaveLength(23);
    expect(new Set(SYSTEM_UNITS.map((u) => u.code)).size).toBe(23);
  });

  it('has exactly one base per dimension, with factor 1', () => {
    for (const dimension of UOM_DIMENSIONS) {
      const bases = SYSTEM_UNITS.filter((u) => u.dimension === dimension && u.isBase);
      expect(bases, dimension).toHaveLength(1);
      expect(bases[0]!.factor).toBe('1');
    }
    expect(SYSTEM_UNITS.filter((u) => u.isBase).map((u) => u.code)).toEqual([
      'und',
      'min',
      'g',
      'ml',
      'mm',
    ]);
  });

  it('defines the exact conversion factors', () => {
    const factor = (code: string) => SYSTEM_UNITS.find((u) => u.code === code)!.factor;
    expect(
      Object.fromEntries(
        ['par', 'doc', 'h', 'd', 'sem', 'kg', 'lb', 'oz'].map((c) => [c, factor(c)]),
      ),
    ).toEqual({
      par: '2',
      doc: '12',
      h: '60',
      d: '1440',
      sem: '10080',
      kg: '1000',
      lb: '453.59237',
      oz: '28.349523125',
    });
    expect(
      Object.fromEntries(['l', 'fl oz', 'gal', 'cm', 'm', 'in', 'ft'].map((c) => [c, factor(c)])),
    ).toEqual({
      l: '1000',
      'fl oz': '29.5735295625',
      gal: '3785.411784',
      cm: '10',
      m: '1000',
      in: '25.4',
      ft: '304.8',
    });
    for (const unit of SYSTEM_UNITS) expect(isPositiveDecimal(unit.factor), unit.code).toBe(true);
  });

  it('carries the plural of every unit', () => {
    expect(SYSTEM_UNITS.map((u) => u.pluralName)).toEqual([
      'Unidades',
      'Personas',
      'Servicios',
      'Cajas',
      'Pares',
      'Docenas',
      'Minutos',
      'Horas',
      'Días',
      'Semanas',
      'Gramos',
      'Kilogramos',
      'Libras',
      'Onzas',
      'Mililitros',
      'Litros',
      'Onzas líquidas',
      'Galones',
      'Milímetros',
      'Centímetros',
      'Metros',
      'Pulgadas',
      'Pies',
    ]);
  });

  it('matches the dimensions of the database enum', () => {
    expect(uomDimensionEnum.enumValues).toEqual([...UOM_DIMENSIONS]);
  });
});

describe('normalizeDecimal', () => {
  it.each([
    ['60.0000000000', '60'],
    ['0.5000', '0.5'],
    ['007', '7'],
    ['1', '1'],
    ['0', '0'],
    ['28.3495231250', '28.349523125'],
  ])('%s -> %s', (input, output) => {
    expect(normalizeDecimal(input)).toBe(output);
  });
});

describe('createUnitSchema', () => {
  it('accepts a positive decimal factor and trims the texts', () => {
    expect(createUnitSchema.parse({ ...valid, code: ' bdj ', factor: '0.25' })).toEqual({
      ...valid,
      factor: '0.25',
    });
  });

  it.each(['0', '0.000', '-1', 'abc', '1.12345678901', '123456789012345', ''])(
    'rejects the factor %j',
    (factor) => {
      const result = createUnitSchema.safeParse({ ...valid, factor });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('unitsOfMeasure.validation.factorInvalid');
    },
  );

  it('requires name, plural and code', () => {
    const result = createUnitSchema.safeParse({ ...valid, name: ' ', pluralName: '', code: '' });
    expect(result.error?.issues.map((i) => i.message).sort()).toEqual([
      'unitsOfMeasure.validation.codeRequired',
      'unitsOfMeasure.validation.nameRequired',
      'unitsOfMeasure.validation.pluralNameRequired',
    ]);
  });

  it('drops isBase: organizations cannot create base units', () => {
    expect(createUnitSchema.parse({ ...valid, isBase: true })).not.toHaveProperty('isBase');
  });
});

describe('unitsOfMeasureListQuerySchema', () => {
  it('sorts by the catalog order ascending by default', () => {
    expect(unitsOfMeasureListQuerySchema.parse({})).toMatchObject({
      sortBy: 'sortOrder',
      sortDir: 'asc',
    });
  });
});
