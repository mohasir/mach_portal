import { z } from 'zod';
import { optionalText } from './fields';

// ── product ──
const productMutationFields = {
  name: z.string().trim().min(1, 'catalog.validation.nameRequired').max(120),
  description: optionalText(500),
  basePrice: z.number().int().min(0, 'catalog.validation.basePriceInvalid'), // cents
  isPremium: z.boolean(),
} as const;

export const createProductSchema = z.object(productMutationFields);
export const updateProductSchema = z.object(productMutationFields);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ── option_group ──
const maxSelectField = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.number().int().min(1, 'catalog.validation.maxSelectInvalid').optional(),
);

export const createOptionGroupSchema = z.object({
  productId: z.uuid(),
  label: z.string().trim().min(1, 'catalog.validation.labelRequired').max(120),
  maxSelect: maxSelectField,
});

export const updateOptionGroupSchema = z.object({
  label: z.string().trim().min(1, 'catalog.validation.labelRequired').max(120),
  maxSelect: maxSelectField,
});

export type CreateOptionGroupInput = z.infer<typeof createOptionGroupSchema>;
export type UpdateOptionGroupInput = z.infer<typeof updateOptionGroupSchema>;

// ── option ──
export const createOptionSchema = z.object({
  optionGroupId: z.uuid(),
  name: z.string().trim().min(1, 'catalog.validation.nameRequired').max(120),
});

export const updateOptionSchema = z.object({
  name: z.string().trim().min(1, 'catalog.validation.nameRequired').max(120),
});

export type CreateOptionInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;

// ── shared across the 3 levels ──
export const catalogReorderSchema = z.object({
  ids: z.array(z.uuid()).min(1),
});
export type CatalogReorderInput = z.infer<typeof catalogReorderSchema>;

export const catalogToggleActiveSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});
export type CatalogToggleActiveInput = z.infer<typeof catalogToggleActiveSchema>;
