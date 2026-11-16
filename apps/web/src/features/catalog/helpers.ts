import type { PriceTierInput, UpdateProductInput } from '@repo/schemas';

export interface ProductFormValues {
  name: string;
  description?: string;
  isPremium: boolean;
  price?: number | null;
  uomId: string;
}

export interface CatalogFeatures {
  priceTiers: boolean;
  configurableOptions: boolean;
}

/** Product mutation input; `tiers` may be omitted to leave stored tiers untouched. */
export type ProductPayload = Omit<UpdateProductInput, 'tiers'> & { tiers?: PriceTierInput[] };

export type DetailTab = 'details' | 'prices';

export function buildProductPayload(
  values: ProductFormValues,
  { tiers, priceTiersEnabled }: { tiers: PriceTierInput[]; priceTiersEnabled: boolean },
): ProductPayload {
  return {
    name: values.name,
    description: values.description,
    isPremium: values.isPremium ?? false,
    price: values.price ?? null,
    uomId: values.uomId,
    // Stored tiers are kept untouched while the add-on is off; the API rejects any tiers then.
    ...(priceTiersEnabled ? { tiers } : {}),
  };
}

export function getDetailTabs({ priceTiers, configurableOptions }: CatalogFeatures): DetailTab[] {
  return [
    ...(configurableOptions ? (['details'] as const) : []),
    ...(priceTiers ? (['prices'] as const) : []),
  ];
}

export const isNotQuotable = (product: { quotable: boolean }) => !product.quotable;

export const getNotQuotableHintKey = (priceTiersEnabled: boolean) =>
  priceTiersEnabled ? 'product.notQuotable.hintPriceOrTiers' : 'product.notQuotable.hintFixedPrice';
