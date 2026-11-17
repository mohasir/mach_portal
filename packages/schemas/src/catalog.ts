import { z } from 'zod';
import { optionalText } from './fields';

export const OPTION_GROUP_TYPES = ['select', 'included'] as const;
export const optionGroupTypeSchema = z.enum(OPTION_GROUP_TYPES);
export type OptionGroupType = z.infer<typeof optionGroupTypeSchema>;

// Prices are stored in Postgres integer columns; larger values would fail at insert time.
const PG_INT_MAX = 2_147_483_647;

export const SKU_MAX = 64;

export const priceTierSchema = z.object({
  quantity: z.number().int().min(1, 'catalog.validation.quantityInvalid'),
  price: z
    .number()
    .int()
    .min(0, 'catalog.validation.priceInvalid')
    .max(PG_INT_MAX, 'catalog.validation.priceInvalid'), // cents, total for quantity
});
export type PriceTierInput = z.infer<typeof priceTierSchema>;

export const productTiersSchema = z
  .array(priceTierSchema)
  .default([])
  .refine((tiers) => new Set(tiers.map((t) => t.quantity)).size === tiers.length, {
    message: 'catalog.validation.tiersDuplicate',
  });

export const SHORT_DESCRIPTION_MAX = 500;
export const LONG_DESCRIPTION_MAX = 10000;

const productMutationFields = {
  name: z.string().trim().min(1, 'catalog.validation.nameRequired').max(120),
  shortDescription: optionalText(SHORT_DESCRIPTION_MAX),
  longDescription: optionalText(LONG_DESCRIPTION_MAX),
  isPremium: z.boolean(),
  // Unit the price and the quantity of the product are expressed in.
  uomId: z.uuid('catalog.validation.unitRequired'),
  tiers: productTiersSchema,
  // Per-unit price in cents; null clears it, omitted keeps the stored one on update.
  price: z
    .number()
    .int()
    .min(0, 'catalog.validation.priceInvalid')
    .max(PG_INT_MAX, 'catalog.validation.priceInvalid')
    .nullable()
    .optional(),
  // A blank SKU clears it (null) instead of keeping the stored one (undefined).
  sku: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || null : v),
    z.string().max(SKU_MAX, 'catalog.validation.skuInvalid').nullable().optional(),
  ),
  // Internal cost in cents, written only with the product_cost update permission. Null clears it,
  // omitted keeps the stored one on update.
  cost: z
    .number()
    .int()
    .min(0, 'catalog.validation.costInvalid')
    .max(PG_INT_MAX, 'catalog.validation.costInvalid')
    .nullable()
    .optional(),
  // Smallest quantity a quote line of the product may have, in the product's unit. Omitted keeps
  // the stored one on update (1 on create).
  minQuantity: z
    .number()
    .int()
    .min(1, 'catalog.validation.minQuantityInvalid')
    .max(PG_INT_MAX, 'catalog.validation.minQuantityInvalid')
    .optional(),
  // Null leaves the product without a category; omitted keeps the stored one on update.
  categoryId: z.uuid().nullable().optional(),
} as const;

export const createProductSchema = z.object(productMutationFields);
export const updateProductSchema = z.object(productMutationFields);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const updateProductTiersSchema = z.object({
  tiers: productTiersSchema,
});
export type UpdateProductTiersInput = z.infer<typeof updateProductTiersSchema>;

// ── option_group ──
const maxSelectField = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.number().int().min(1, 'catalog.validation.maxSelectInvalid').optional(),
);

const optionGroupMutationFields = {
  label: z.string().trim().min(1, 'catalog.validation.labelRequired').max(120),
  selectionType: optionGroupTypeSchema,
  maxSelect: maxSelectField, // only meaningful for 'select'
} as const;

export const createOptionGroupSchema = z.object({
  productId: z.uuid(),
  ...optionGroupMutationFields,
});

export const updateOptionGroupSchema = z.object(optionGroupMutationFields);

export type CreateOptionGroupInput = z.infer<typeof createOptionGroupSchema>;
export type UpdateOptionGroupInput = z.infer<typeof updateOptionGroupSchema>;

// ── option ──
const optionMutationFields = {
  name: z.string().trim().min(1, 'catalog.validation.nameRequired').max(120),
  description: optionalText(300), // e.g. cocktail ingredients (D17)
} as const;

export const createOptionSchema = z.object({
  optionGroupId: z.uuid(),
  ...optionMutationFields,
});

export const updateOptionSchema = z.object(optionMutationFields);

export type CreateOptionInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;

// ── shared across the 3 levels ──
export const catalogReorderSchema = z.object({
  ids: z.array(z.uuid()).min(1),
});
export type CatalogReorderInput = z.infer<typeof catalogReorderSchema>;

export const catalogIdSchema = z.object({
  id: z.uuid(),
});
export type CatalogIdInput = z.infer<typeof catalogIdSchema>;
