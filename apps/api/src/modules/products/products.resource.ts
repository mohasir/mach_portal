import { isQuotable } from './products.pricing';
import {
  options,
  optionGroups,
  productPriceTiers,
  products,
  unitsOfMeasure,
} from '../../db/schema';

export const publicProductColumns = {
  id: products.id,
  name: products.name,
  description: products.description,
  isPremium: products.isPremium,
  isActive: products.isActive,
  sortOrder: products.sortOrder,
  price: products.price,
  uomId: products.uomId,
} as const;

// What the web needs to write a quantity in the product's unit ("40 personas", "5 kg").
export const unitRefColumns = {
  id: unitsOfMeasure.id,
  name: unitsOfMeasure.name,
  pluralName: unitsOfMeasure.pluralName,
  code: unitsOfMeasure.code,
  dimension: unitsOfMeasure.dimension,
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

export type PublicProduct = Pick<typeof products.$inferSelect, keyof typeof publicProductColumns>;
export type UnitRef = Pick<typeof unitsOfMeasure.$inferSelect, keyof typeof unitRefColumns>;
export type UnitsById = ReadonlyMap<string, UnitRef>;
export type PublicTier = Pick<
  typeof productPriceTiers.$inferSelect,
  keyof typeof publicTierColumns
>;
export type PublicOptionGroup = Pick<
  typeof optionGroups.$inferSelect,
  keyof typeof publicOptionGroupColumns
>;
export type PublicOption = Pick<typeof options.$inferSelect, keyof typeof publicOptionColumns>;

const unitRefResource = (unit: UnitRef) => ({
  id: unit.id,
  name: unit.name,
  pluralName: unit.pluralName,
  code: unit.code,
  dimension: unit.dimension,
});

export const productResource = (row: PublicProduct, quotable: boolean, unit: UnitRef) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  isPremium: row.isPremium,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  price: row.price,
  uomId: row.uomId,
  unit: unitRefResource(unit),
  quotable,
});

// products.uom_id is NOT NULL with a foreign key, so a missing entry means the units were read
// from another tenant or another snapshot: a bug, never user input.
const unitOf = (product: PublicProduct, units: UnitsById): UnitRef => {
  const unit = units.get(product.uomId);
  if (!unit) throw new Error(`Unit ${product.uomId} of product ${product.id} was not loaded`);
  return unit;
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
export type CatalogUsage = { optionIds: Set<string>; groupIds: Set<string> };
export type ProductWithGroups = ProductResource & {
  priceTiers: TierResource[];
  optionGroups: OptionGroupWithOptions[];
};

export type ProductWithTiers = ProductResource & { priceTiers: TierResource[] };

export const productWithTiersResource = (
  product: PublicProduct,
  tierRows: PublicTier[],
  priceTiersActive: boolean,
  units: UnitsById,
): ProductWithTiers => ({
  ...productResource(
    product,
    isQuotable(product, tierRows, priceTiersActive),
    unitOf(product, units),
  ),
  priceTiers: tierRows.map(tierResource),
});

export const buildProductTree = (
  productRows: PublicProduct[],
  tierRows: PublicTier[],
  groupRows: PublicOptionGroup[],
  optionRows: PublicOption[],
  priceTiersActive: boolean,
  units: UnitsById,
): ProductWithGroups[] =>
  productRows.map((product) => {
    const productTiers = tierRows.filter((tier) => tier.productId === product.id);
    return {
      ...productResource(
        product,
        isQuotable(product, productTiers, priceTiersActive),
        unitOf(product, units),
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
  units: UnitsById,
): ProductWithTiers[] =>
  productRows.map((product) =>
    productWithTiersResource(
      product,
      tierRows.filter((tier) => tier.productId === product.id),
      priceTiersActive,
      units,
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
