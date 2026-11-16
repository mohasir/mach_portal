import { z } from 'zod';
import { listQuerySchema, sortDirSchema } from './pagination';

export const productCategoriesListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'isActive', 'sortOrder']).default('sortOrder'),
  sortDir: sortDirSchema.default('asc'),
  isActive: z.boolean().optional(),
});
export type ProductCategoriesListQuery = z.infer<typeof productCategoriesListQuerySchema>;

const categoryMutationFields = {
  name: z.string().trim().min(1, 'productCategories.validation.nameRequired').max(60),
} as const;

export const createProductCategorySchema = z.object(categoryMutationFields);
export const updateProductCategorySchema = z.object(categoryMutationFields);

export type CreateProductCategoryInput = z.infer<typeof createProductCategorySchema>;
export type UpdateProductCategoryInput = z.infer<typeof updateProductCategorySchema>;
