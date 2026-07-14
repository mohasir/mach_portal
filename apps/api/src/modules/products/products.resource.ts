import { options, optionGroups, productPriceTiers, products } from '../../db/schema';

export const publicProductColumns = {
  id: products.id,
  name: products.name,
  description: products.description,
  isPremium: products.isPremium,
  isActive: products.isActive,
  sortOrder: products.sortOrder,
} as const;

export const publicTierColumns = {
  id: productPriceTiers.id,
  productId: productPriceTiers.productId,
  numPersons: productPriceTiers.numPersons,
  price: productPriceTiers.price,
  sortOrder: productPriceTiers.sortOrder,
} as const;

export const publicOptionGroupColumns = {
  id: optionGroups.id,
  productId: optionGroups.productId,
  label: optionGroups.label,
  selectionType: optionGroups.selectionType,
  maxSelect: optionGroups.maxSelect,
  isActive: optionGroups.isActive,
  sortOrder: optionGroups.sortOrder,
} as const;

export const publicOptionColumns = {
  id: options.id,
  optionGroupId: options.optionGroupId,
  name: options.name,
  description: options.description,
  isActive: options.isActive,
  sortOrder: options.sortOrder,
} as const;

export type PublicProduct = Pick<typeof products.$inferSelect, keyof typeof publicProductColumns>;
export type PublicTier = Pick<
  typeof productPriceTiers.$inferSelect,
  keyof typeof publicTierColumns
>;
export type PublicOptionGroup = Pick<
  typeof optionGroups.$inferSelect,
  keyof typeof publicOptionGroupColumns
>;
export type PublicOption = Pick<typeof options.$inferSelect, keyof typeof publicOptionColumns>;

export const productResource = (row: PublicProduct) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  isPremium: row.isPremium,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

export const tierResource = (row: PublicTier) => ({
  id: row.id,
  numPersons: row.numPersons,
  price: row.price,
  sortOrder: row.sortOrder,
});

export const optionGroupResource = (row: PublicOptionGroup) => ({
  id: row.id,
  productId: row.productId,
  label: row.label,
  selectionType: row.selectionType,
  maxSelect: row.maxSelect,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

export const optionResource = (row: PublicOption) => ({
  id: row.id,
  optionGroupId: row.optionGroupId,
  name: row.name,
  description: row.description,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

export type ProductResource = ReturnType<typeof productResource>;
export type TierResource = ReturnType<typeof tierResource>;
export type OptionGroupResource = ReturnType<typeof optionGroupResource>;
export type OptionResource = ReturnType<typeof optionResource>;

export type OptionGroupWithOptions = OptionGroupResource & { options: OptionResource[] };
export type ProductWithGroups = ProductResource & {
  priceTiers: TierResource[];
  optionGroups: OptionGroupWithOptions[];
};

export type ProductWithTiers = ProductResource & { priceTiers: TierResource[] };

export const productWithTiersResource = (
  product: PublicProduct,
  tierRows: PublicTier[],
): ProductWithTiers => ({
  ...productResource(product),
  priceTiers: tierRows.map(tierResource),
});

export const buildProductTree = (
  productRows: PublicProduct[],
  tierRows: PublicTier[],
  groupRows: PublicOptionGroup[],
  optionRows: PublicOption[],
): ProductWithGroups[] =>
  productRows.map((product) => ({
    ...productResource(product),
    priceTiers: tierRows.filter((tier) => tier.productId === product.id).map(tierResource),
    optionGroups: groupRows
      .filter((group) => group.productId === product.id)
      .map((group) => ({
        ...optionGroupResource(group),
        options: optionRows
          .filter((option) => option.optionGroupId === group.id)
          .map(optionResource),
      })),
  }));

export const buildPricesList = (
  productRows: PublicProduct[],
  tierRows: PublicTier[],
): ProductWithTiers[] =>
  productRows.map((product) =>
    productWithTiersResource(
      product,
      tierRows.filter((tier) => tier.productId === product.id),
    ),
  );
