import { isQuotable } from './products.pricing';
import {
  options,
  optionGroups,
  productCategories,
  productImages,
  productPriceTiers,
  products,
  unitsOfMeasure,
} from '../../db/schema';

// `cost` is deliberately absent: it is internal and only `productCostColumns` selects it.
export const publicProductColumns = {
  id: products.id,
  name: products.name,
  shortDescription: products.shortDescription,
  longDescription: products.longDescription,
  isPremium: products.isPremium,
  isActive: products.isActive,
  sortOrder: products.sortOrder,
  price: products.price,
  uomId: products.uomId,
  categoryId: products.categoryId,
  sku: products.sku,
  minQuantity: products.minQuantity,
  taxRate: products.taxRate,
  taxExempt: products.taxExempt,
} as const;

// Added to the selection only for callers holding product_cost.read.
export const productCostColumns = { ...publicProductColumns, cost: products.cost } as const;

export const categoryRefColumns = {
  id: productCategories.id,
  name: productCategories.name,
  isActive: productCategories.isActive,
} as const;

// What the web needs to write a quantity in the product's unit ("40 personas", "5 kg").
export const unitRefColumns = {
  id: unitsOfMeasure.id,
  name: unitsOfMeasure.name,
  pluralName: unitsOfMeasure.pluralName,
  code: unitsOfMeasure.code,
  dimension: unitsOfMeasure.dimension,
} as const;

// The storage keys stay on the server: only the public URLs leave it.
export const publicImageColumns = {
  id: productImages.id,
  productId: productImages.productId,
  imageUrl: productImages.imageUrl,
  thumbUrl: productImages.thumbUrl,
  isFeatured: productImages.isFeatured,
  sortOrder: productImages.sortOrder,
} as const;

export const publicTierColumns = {
  id: productPriceTiers.id,
  productId: productPriceTiers.productId,
  quantity: productPriceTiers.quantity,
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

// A row read with `productCostColumns` carries `cost`; one read with `publicProductColumns` does not.
export type PublicProduct = Pick<
  typeof products.$inferSelect,
  keyof typeof publicProductColumns
> & {
  cost?: number | null;
};
export type UnitRef = Pick<typeof unitsOfMeasure.$inferSelect, keyof typeof unitRefColumns>;
export type UnitsById = ReadonlyMap<string, UnitRef>;
export type CategoryRef = Pick<
  typeof productCategories.$inferSelect,
  keyof typeof categoryRefColumns
>;
export type CategoriesById = ReadonlyMap<string, CategoryRef>;
export type PublicImage = Pick<typeof productImages.$inferSelect, keyof typeof publicImageColumns>;
// Each product's images in display order; a product without images has no entry.
export type ImagesByProduct = ReadonlyMap<string, readonly PublicImage[]>;

// Whether the caller may read the internal cost; false unless a caller states otherwise.
export type CostVisibility = { canSeeCost?: boolean };
export type PublicTier = Pick<
  typeof productPriceTiers.$inferSelect,
  keyof typeof publicTierColumns
>;
export type PublicOptionGroup = Pick<
  typeof optionGroups.$inferSelect,
  keyof typeof publicOptionGroupColumns
>;
export type PublicOption = Pick<typeof options.$inferSelect, keyof typeof publicOptionColumns>;

export const unitRefResource = (unit: UnitRef) => ({
  id: unit.id,
  name: unit.name,
  pluralName: unit.pluralName,
  code: unit.code,
  dimension: unit.dimension,
});

const categoryRefResource = (category: CategoryRef) => ({
  id: category.id,
  name: category.name,
  isActive: category.isActive,
});

export const productImageResource = (row: PublicImage) => ({
  id: row.id,
  imageUrl: row.imageUrl,
  thumbUrl: row.thumbUrl,
  isFeatured: row.isFeatured,
  sortOrder: row.sortOrder,
});

export type ProductImageResource = ReturnType<typeof productImageResource>;

export type ProductRefs = {
  quotable: boolean;
  unit: UnitRef;
  category: CategoryRef | null;
  images: readonly PublicImage[];
};

export const productResource = (
  row: PublicProduct,
  { quotable, unit, category, images }: ProductRefs,
  { canSeeCost = false }: CostVisibility = {},
) => ({
  id: row.id,
  name: row.name,
  shortDescription: row.shortDescription,
  longDescription: row.longDescription,
  isPremium: row.isPremium,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  price: row.price,
  uomId: row.uomId,
  unit: unitRefResource(unit),
  categoryId: row.categoryId,
  category: category ? categoryRefResource(category) : null,
  sku: row.sku,
  minQuantity: row.minQuantity,
  taxRate: row.taxRate,
  taxExempt: row.taxExempt,
  images: images.map(productImageResource),
  quotable,
  ...(canSeeCost ? { cost: row.cost ?? null } : {}),
});

// products.uom_id is NOT NULL with a foreign key, so a missing entry means the units were read
// from another tenant or another snapshot: a bug, never user input.
const unitOf = (product: PublicProduct, units: UnitsById): UnitRef => {
  const unit = units.get(product.uomId);
  if (!unit) throw new Error(`Unit ${product.uomId} of product ${product.id} was not loaded`);
  return unit;
};

// Same reasoning as unitOf, for the optional category.
const categoryOf = (product: PublicProduct, categories: CategoriesById): CategoryRef | null => {
  if (!product.categoryId) return null;
  const category = categories.get(product.categoryId);
  if (!category) {
    throw new Error(`Category ${product.categoryId} of product ${product.id} was not loaded`);
  }
  return category;
};

// What a product row refers to, read once per list.
export type ProductLookups = {
  units: UnitsById;
  categories: CategoriesById;
  images: ImagesByProduct;
};

export const tierResource = (row: PublicTier) => ({
  id: row.id,
  quantity: row.quantity,
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

// Ids already referenced by quote lines; those rows can only be deactivated, never deleted.
export type CatalogUsage = {
  optionIds: Set<string>;
  groupIds: Set<string>;
};
export type ProductWithGroups = ProductResource & {
  priceTiers: TierResource[];
  optionGroups: OptionGroupWithOptions[];
};

export type ProductWithTiers = ProductResource & { priceTiers: TierResource[] };

const refsOf = (
  product: PublicProduct,
  tiers: readonly { quantity: number }[],
  priceTiersActive: boolean,
  { units, categories, images }: ProductLookups,
): ProductRefs => ({
  quotable: isQuotable(product, tiers, priceTiersActive),
  unit: unitOf(product, units),
  category: categoryOf(product, categories),
  images: images.get(product.id) ?? [],
});

export const productWithTiersResource = (
  product: PublicProduct,
  tierRows: PublicTier[],
  priceTiersActive: boolean,
  lookups: ProductLookups,
  visibility: CostVisibility = {},
): ProductWithTiers => ({
  ...productResource(product, refsOf(product, tierRows, priceTiersActive, lookups), visibility),
  priceTiers: tierRows.map(tierResource),
});

export const buildProductTree = (
  productRows: PublicProduct[],
  tierRows: PublicTier[],
  groupRows: PublicOptionGroup[],
  optionRows: PublicOption[],
  priceTiersActive: boolean,
  lookups: ProductLookups,
  visibility: CostVisibility = {},
): ProductWithGroups[] =>
  productRows.map((product) => {
    const productTiers = tierRows.filter((tier) => tier.productId === product.id);
    return {
      ...productResource(
        product,
        refsOf(product, productTiers, priceTiersActive, lookups),
        visibility,
      ),
      priceTiers: productTiers.map(tierResource),
      optionGroups: groupRows
        .filter((group) => group.productId === product.id)
        .map((group) => ({
          ...optionGroupResource(group),
          options: optionRows
            .filter((option) => option.optionGroupId === group.id)
            .map(optionResource),
        })),
    };
  });

export const buildPricesList = (
  productRows: PublicProduct[],
  tierRows: PublicTier[],
  priceTiersActive: boolean,
  lookups: ProductLookups,
  visibility: CostVisibility = {},
): ProductWithTiers[] =>
  productRows.map((product) =>
    productWithTiersResource(
      product,
      tierRows.filter((tier) => tier.productId === product.id),
      priceTiersActive,
      lookups,
      visibility,
    ),
  );

export type CatalogProduct = Omit<ProductWithGroups, 'optionGroups'> & {
  optionGroups: (Omit<OptionGroupWithOptions, 'options'> & {
    isUsed: boolean;
    options: (OptionResource & { isUsed: boolean })[];
  })[];
};

export const withCatalogUsage = (
  tree: ProductWithGroups[],
  usage: CatalogUsage,
): CatalogProduct[] =>
  tree.map((product) => ({
    ...product,
    optionGroups: product.optionGroups.map((group) => ({
      ...group,
      isUsed: usage.groupIds.has(group.id),
      options: group.options.map((option) => ({
        ...option,
        isUsed: usage.optionIds.has(option.id),
      })),
    })),
  }));
