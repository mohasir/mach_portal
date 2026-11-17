import { describe, expect, it } from 'vitest';
import { createProductCategorySchema, productCategoriesListQuerySchema } from '@repo/schemas';

describe('product category schemas', () => {
  it('trims the name and requires it', () => {
    expect(createProductCategorySchema.parse({ name: '  Bebidas ' })).toEqual({ name: 'Bebidas' });
    const blank = createProductCategorySchema.safeParse({ name: '   ' });
    expect(blank.error?.issues[0]?.message).toBe('productCategories.validation.nameRequired');
    expect(createProductCategorySchema.safeParse({ name: 'x'.repeat(61) }).success).toBe(false);
  });

  it('lists in catalog order by default', () => {
    expect(productCategoriesListQuerySchema.parse({})).toMatchObject({
      sortBy: 'sortOrder',
      sortDir: 'asc',
    });
    expect(productCategoriesListQuerySchema.safeParse({ sortBy: 'tenantId' }).success).toBe(false);
  });
});
