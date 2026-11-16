import { normalizeDecimal } from '@repo/schemas';
import { unitsOfMeasure } from '../../db/schema';

export const publicUnitColumns = {
  id: unitsOfMeasure.id,
  name: unitsOfMeasure.name,
  pluralName: unitsOfMeasure.pluralName,
  code: unitsOfMeasure.code,
  dimension: unitsOfMeasure.dimension,
  factor: unitsOfMeasure.factor,
  isBase: unitsOfMeasure.isBase,
  isSystem: unitsOfMeasure.isSystem,
  isActive: unitsOfMeasure.isActive,
  sortOrder: unitsOfMeasure.sortOrder,
} as const;

export type PublicUnit = Pick<typeof unitsOfMeasure.$inferSelect, keyof typeof publicUnitColumns>;

// `isUsed`: a product references the unit, so its dimension and factor are locked.
export const unitResource = (row: PublicUnit & { isUsed: boolean }) => ({
  id: row.id,
  name: row.name,
  pluralName: row.pluralName,
  code: row.code,
  dimension: row.dimension,
  factor: normalizeDecimal(row.factor),
  isBase: row.isBase,
  isSystem: row.isSystem,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  isUsed: row.isUsed,
});

export const unitCollectionResource = (rows: (PublicUnit & { isUsed: boolean })[]) =>
  rows.map(unitResource);

export type UnitResource = ReturnType<typeof unitResource>;
