import { options, optionGroups, products } from '../../db/schema';

export const publicProductColumns = {
  id: products.id,
  name: products.name,
  description: products.description,
  basePrice: products.basePrice,
  isPremium: products.isPremium,
  isActive: products.isActive,
  sortOrder: products.sortOrder,
} as const;

export const publicOptionGroupColumns = {
  id: optionGroups.id,
  productId: optionGroups.productId,
  label: optionGroups.label,
  maxSelect: optionGroups.maxSelect,
  isActive: optionGroups.isActive,
  sortOrder: optionGroups.sortOrder,
} as const;

export const publicOptionColumns = {
  id: options.id,
  optionGroupId: options.optionGroupId,
  name: options.name,
  isActive: options.isActive,
  sortOrder: options.sortOrder,
} as const;

export type PublicProduct = Pick<typeof products.$inferSelect, keyof typeof publicProductColumns>;
export type PublicOptionGroup = Pick<
  typeof optionGroups.$inferSelect,
  keyof typeof publicOptionGroupColumns
>;
export type PublicOption = Pick<typeof options.$inferSelect, keyof typeof publicOptionColumns>;

export const productResource = (row: PublicProduct) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  basePrice: row.basePrice,
  isPremium: row.isPremium,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

export const optionGroupResource = (row: PublicOptionGroup) => ({
  id: row.id,
  productId: row.productId,
  label: row.label,
  maxSelect: row.maxSelect,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

export const optionResource = (row: PublicOption) => ({
  id: row.id,
  optionGroupId: row.optionGroupId,
  name: row.name,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

export type ProductResource = ReturnType<typeof productResource>;
export type OptionGroupResource = ReturnType<typeof optionGroupResource>;
export type OptionResource = ReturnType<typeof optionResource>;

export type OptionGroupWithOptions = OptionGroupResource & { options: OptionResource[] };
export type ProductWithGroups = ProductResource & { optionGroups: OptionGroupWithOptions[] };

// Assembles the flat rows from the 3 tables into the nested tree the editor and
// builder both consume (docs/mach-bar-flows.md §2.1, §4.5). Catalog size is small
// (~10 products, few dozen options total), so in-memory grouping beats a joined
// query that would repeat parent columns per child row.
export const buildProductTree = (
  productRows: PublicProduct[],
  groupRows: PublicOptionGroup[],
  optionRows: PublicOption[],
): ProductWithGroups[] =>
  productRows.map((product) => ({
    ...productResource(product),
    optionGroups: groupRows
      .filter((group) => group.productId === product.id)
      .map((group) => ({
        ...optionGroupResource(group),
        options: optionRows.filter((option) => option.optionGroupId === group.id).map(optionResource),
      })),
  }));
