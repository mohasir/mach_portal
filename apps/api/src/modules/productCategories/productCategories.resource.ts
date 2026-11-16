import { productCategories } from '../../db/schema';

export const publicCategoryColumns = {
  id: productCategories.id,
  name: productCategories.name,
  isActive: productCategories.isActive,
  sortOrder: productCategories.sortOrder,
} as const;

export type PublicCategory = Pick<
  typeof productCategories.$inferSelect,
  keyof typeof publicCategoryColumns
>;

// `productCount`: products (active or not) in the category; with any, it can only be deactivated.
export const categoryResource = (row: PublicCategory & { productCount: number }) => ({
  id: row.id,
  name: row.name,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  productCount: row.productCount,
});

export const categoryCollectionResource = (rows: (PublicCategory & { productCount: number })[]) =>
  rows.map(categoryResource);

export type CategoryResource = ReturnType<typeof categoryResource>;
