import { z } from 'zod';
import { listQuerySchema, sortDirSchema } from './pagination';

export const CHARGE_KINDS = ['fixed', 'percent'] as const;
export const chargeKindSchema = z.enum(CHARGE_KINDS);
export type ChargeKind = z.infer<typeof chargeKindSchema>;

// Fixed values are integer cents and percent values a rate, both stored as numeric(14,5). A single
// fixed charge stays within the int4 amount column; the quote total is bounded when it is priced.
export const CHARGE_FIXED_MAX = 999_999_999;
const PERCENT_SCALE = 100_000;

/** The value as it is stored: a rate rounded to the 5 decimals of its column, cents as given. */
export function normalizeChargeValue(kind: ChargeKind, value: number): number {
  return kind === 'percent' ? Math.round(value * PERCENT_SCALE) / PERCENT_SCALE : value;
}

/** A percent charge is a rate above 0 up to 1; a fixed one, whole cents from 0. */
export function isValidChargeValue(kind: ChargeKind, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (kind === 'percent') {
    const rate = normalizeChargeValue(kind, value);
    return rate > 0 && rate <= 1;
  }
  return Number.isInteger(value) && value >= 0 && value <= CHARGE_FIXED_MAX;
}

export const chargeTypesListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'kind', 'isActive', 'sortOrder']).default('sortOrder'),
  sortDir: sortDirSchema.default('asc'),
  isActive: z.boolean().optional(),
});
export type ChargeTypesListQuery = z.infer<typeof chargeTypesListQuerySchema>;

const chargeTypeSchema = z
  .object({
    name: z.string().trim().min(1, 'chargeTypes.validation.nameRequired').max(60),
    kind: chargeKindSchema,
    defaultValue: z.number(),
  })
  .refine((data) => isValidChargeValue(data.kind, data.defaultValue), {
    message: 'chargeTypes.validation.valueInvalid',
    path: ['defaultValue'],
  })
  .transform((data) => ({
    ...data,
    defaultValue: normalizeChargeValue(data.kind, data.defaultValue),
  }));

export const createChargeTypeSchema = chargeTypeSchema;
export const updateChargeTypeSchema = chargeTypeSchema;

export type CreateChargeTypeInput = z.infer<typeof createChargeTypeSchema>;
export type UpdateChargeTypeInput = z.infer<typeof updateChargeTypeSchema>;

// The kind of a charge is only known once its type is read, so the range is checked by the
// service; the schema rejects what no kind accepts.
export const quoteChargeInputSchema = z.object({
  chargeTypeId: z.uuid(),
  value: z.number().min(0, 'quotes:validation.chargeValueInvalid').optional(),
});
export type QuoteChargeInput = z.infer<typeof quoteChargeInputSchema>;

export const quoteChargesInputSchema = z
  .array(quoteChargeInputSchema)
  .default([])
  .refine((charges) => new Set(charges.map((c) => c.chargeTypeId)).size === charges.length, {
    message: 'quotes:validation.chargeDuplicated',
  });
