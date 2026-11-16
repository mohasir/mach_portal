import { z } from 'zod';
import { listQuerySchema, sortDirSchema } from './pagination';

export const UOM_DIMENSIONS = ['quantity', 'time', 'weight', 'volume', 'length'] as const;
export const uomDimensionSchema = z.enum(UOM_DIMENSIONS);
export type UomDimension = z.infer<typeof uomDimensionSchema>;

export interface SystemUnit {
  code: string;
  name: string;
  pluralName: string;
  dimension: UomDimension;
  // Decimal string relative to the dimension's base unit; a float would lose precision.
  factor: string;
  isBase: boolean;
}

// Every organization starts with this list (seed and migration 0009 insert exactly these rows).
// The base of each dimension is its smallest unit so that every factor is exact.
export const SYSTEM_UNITS: readonly SystemUnit[] = [
  {
    code: 'und',
    name: 'Unidad',
    pluralName: 'Unidades',
    dimension: 'quantity',
    factor: '1',
    isBase: true,
  },
  {
    code: 'pers',
    name: 'Persona',
    pluralName: 'Personas',
    dimension: 'quantity',
    factor: '1',
    isBase: false,
  },
  {
    code: 'serv',
    name: 'Servicio',
    pluralName: 'Servicios',
    dimension: 'quantity',
    factor: '1',
    isBase: false,
  },
  {
    code: 'caja',
    name: 'Caja',
    pluralName: 'Cajas',
    dimension: 'quantity',
    factor: '1',
    isBase: false,
  },
  {
    code: 'par',
    name: 'Par',
    pluralName: 'Pares',
    dimension: 'quantity',
    factor: '2',
    isBase: false,
  },
  {
    code: 'doc',
    name: 'Docena',
    pluralName: 'Docenas',
    dimension: 'quantity',
    factor: '12',
    isBase: false,
  },
  {
    code: 'min',
    name: 'Minuto',
    pluralName: 'Minutos',
    dimension: 'time',
    factor: '1',
    isBase: true,
  },
  { code: 'h', name: 'Hora', pluralName: 'Horas', dimension: 'time', factor: '60', isBase: false },
  { code: 'd', name: 'Día', pluralName: 'Días', dimension: 'time', factor: '1440', isBase: false },
  {
    code: 'sem',
    name: 'Semana',
    pluralName: 'Semanas',
    dimension: 'time',
    factor: '10080',
    isBase: false,
  },
  {
    code: 'g',
    name: 'Gramo',
    pluralName: 'Gramos',
    dimension: 'weight',
    factor: '1',
    isBase: true,
  },
  {
    code: 'kg',
    name: 'Kilogramo',
    pluralName: 'Kilogramos',
    dimension: 'weight',
    factor: '1000',
    isBase: false,
  },
  {
    code: 'lb',
    name: 'Libra',
    pluralName: 'Libras',
    dimension: 'weight',
    factor: '453.59237',
    isBase: false,
  },
  {
    code: 'oz',
    name: 'Onza',
    pluralName: 'Onzas',
    dimension: 'weight',
    factor: '28.349523125',
    isBase: false,
  },
  {
    code: 'ml',
    name: 'Mililitro',
    pluralName: 'Mililitros',
    dimension: 'volume',
    factor: '1',
    isBase: true,
  },
  {
    code: 'l',
    name: 'Litro',
    pluralName: 'Litros',
    dimension: 'volume',
    factor: '1000',
    isBase: false,
  },
  {
    code: 'fl oz',
    name: 'Onza líquida',
    pluralName: 'Onzas líquidas',
    dimension: 'volume',
    factor: '29.5735295625',
    isBase: false,
  },
  {
    code: 'gal',
    name: 'Galón',
    pluralName: 'Galones',
    dimension: 'volume',
    factor: '3785.411784',
    isBase: false,
  },
  {
    code: 'mm',
    name: 'Milímetro',
    pluralName: 'Milímetros',
    dimension: 'length',
    factor: '1',
    isBase: true,
  },
  {
    code: 'cm',
    name: 'Centímetro',
    pluralName: 'Centímetros',
    dimension: 'length',
    factor: '10',
    isBase: false,
  },
  {
    code: 'm',
    name: 'Metro',
    pluralName: 'Metros',
    dimension: 'length',
    factor: '1000',
    isBase: false,
  },
  {
    code: 'in',
    name: 'Pulgada',
    pluralName: 'Pulgadas',
    dimension: 'length',
    factor: '25.4',
    isBase: false,
  },
  {
    code: 'ft',
    name: 'Pie',
    pluralName: 'Pies',
    dimension: 'length',
    factor: '304.8',
    isBase: false,
  },
];

// Unit existing products are assigned to when units are introduced.
export const DEFAULT_UNIT_CODE = 'pers';

// numeric(24,10): at most 14 integer digits and 10 decimals.
const FACTOR_RE = /^\d{1,14}(\.\d{1,10})?$/;

// Canonical text of a decimal string ("60.0000000000" -> "60", "0.50" -> "0.5"), so factors read
// back from numeric columns compare equal to what the user typed.
export function normalizeDecimal(value: string): string {
  const [rawInt = '0', rawFrac = ''] = value.trim().split('.');
  const int = rawInt.replace(/^0+(?=\d)/, '');
  const frac = rawFrac.replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

export const isPositiveDecimal = (value: string) =>
  FACTOR_RE.test(value) && /[1-9]/.test(normalizeDecimal(value));

export const unitsOfMeasureListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'code', 'dimension', 'isActive', 'sortOrder']).default('sortOrder'),
  sortDir: sortDirSchema.default('asc'),
  dimension: uomDimensionSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UnitsOfMeasureListQuery = z.infer<typeof unitsOfMeasureListQuerySchema>;

const unitMutationFields = {
  name: z.string().trim().min(1, 'unitsOfMeasure.validation.nameRequired').max(60),
  pluralName: z.string().trim().min(1, 'unitsOfMeasure.validation.pluralNameRequired').max(60),
  code: z.string().trim().min(1, 'unitsOfMeasure.validation.codeRequired').max(12),
  dimension: uomDimensionSchema,
  factor: z.string().trim().refine(isPositiveDecimal, 'unitsOfMeasure.validation.factorInvalid'),
} as const;

// No `isBase`: the base of every dimension is a system unit, so organizations only add derived units.
export const createUnitSchema = z.object(unitMutationFields);
export const updateUnitSchema = z.object(unitMutationFields);

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
