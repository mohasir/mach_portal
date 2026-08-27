import { z } from 'zod';
import { optionalText } from './fields';

export const OPTION_GROUP_TYPES = ['select', 'included'] as const;
export const optionGroupTypeSchema = z.enum(OPTION_GROUP_TYPES);
export type OptionGroupType = z.infer<typeof optionGroupTypeSchema>;

export const priceTierSchema = z.object({
  numPersons: z.number().int().min(1, 'catalog.validation.numPersonsInvalid'),
  price: z.number().int().min(0, 'catalog.validation.priceInvalid'), // cents, total for numPersons
});
export type PriceTierInput = z.infer<typeof priceTierSchema>;

export const productTiersSchema = z
  .array(priceTierSchema)
  .default([])
  .refine((tiers) => new Set(tiers.map((t) => t.numPersons)).size === tiers.length, {
    message: 'catalog.validation.tiersDuplicate',
  });

const productMutationFields = {
  name: z.string().trim().min(1, 'catalog.validation.nameRequired').max(120),
  description: optionalText(500),
  isPremium: z.boolean(),
  tiers: productTiersSchema,
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
