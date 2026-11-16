import { SYSTEM_UNITS, UOM_DIMENSIONS, type UomDimension } from '@repo/schemas';

interface LockableUnit {
  isSystem: boolean;
  isUsed: boolean;
}

export interface UnitFieldLocks {
  code: boolean;
  dimension: boolean;
  factor: boolean;
}

// Mirrors the API rules: system units keep code, dimension and factor; an own unit a product
// uses keeps dimension and factor.
export function unitFieldLocks(unit: LockableUnit | undefined): UnitFieldLocks {
  if (!unit) return { code: false, dimension: false, factor: false };
  if (unit.isSystem) return { code: true, dimension: true, factor: true };
  return { code: false, dimension: unit.isUsed, factor: unit.isUsed };
}

// The base of every dimension is a system unit, whose code cannot change.
const BASE_CODE = Object.fromEntries(
  SYSTEM_UNITS.filter((u) => u.isBase).map((u) => [u.dimension, u.code]),
) as Record<UomDimension, string>;

export const baseCodeOf = (dimension: UomDimension) => BASE_CODE[dimension];

/** "60 min" for an hour; null for a base unit, whose factor is always 1. */
export function factorLabel(unit: {
  isBase: boolean;
  dimension: UomDimension;
  factor: string;
}): string | null {
  if (unit.isBase) return null;
  return `${unit.factor} ${BASE_CODE[unit.dimension]}`;
}

export interface UnitGroup<T> {
  dimension: UomDimension;
  units: T[];
}

/**
 * Units grouped by dimension in the fixed dimension order, for the unit select. `current` (a unit
 * the product keeps although it was deactivated) is added when missing from `units`.
 */
export function groupUnitsByDimension<T extends { id: string; dimension: UomDimension }>(
  units: readonly T[],
  current?: T,
): UnitGroup<T>[] {
  const all = current && !units.some((u) => u.id === current.id) ? [...units, current] : units;
  return UOM_DIMENSIONS.map((dimension) => ({
    dimension,
    units: all.filter((u) => u.dimension === dimension),
  })).filter((group) => group.units.length > 0);
}
