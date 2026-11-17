import { chargeTypes } from '../../db/schema';

export const publicChargeTypeColumns = {
  id: chargeTypes.id,
  name: chargeTypes.name,
  kind: chargeTypes.kind,
  defaultValue: chargeTypes.defaultValue,
  isActive: chargeTypes.isActive,
  sortOrder: chargeTypes.sortOrder,
} as const;

export type PublicChargeType = Pick<
  typeof chargeTypes.$inferSelect,
  keyof typeof publicChargeTypeColumns
>;

// `defaultValue` is cents for a fixed type and a rate (0..1) for a percent one.
export const chargeTypeResource = (row: PublicChargeType) => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  defaultValue: row.defaultValue,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

export const chargeTypeCollectionResource = (rows: PublicChargeType[]) =>
  rows.map(chargeTypeResource);

export type ChargeTypeResource = ReturnType<typeof chargeTypeResource>;
