import type { PriceTierInput, UpdateProductInput } from '@repo/schemas';

export interface ProductFormValues {
  name: string;
  shortDescription?: string;
  longDescription?: string;
  isPremium: boolean;
  price?: number | null;
  uomId?: string;
  sku?: string | null;
  categoryId?: string | null;
  cost?: number | null;
  minQuantity: number;
}

/**
 * How the product form treats the internal cost. Editing needs read too: without it the stored
 * cost is unknown and saving the form would overwrite it blindly.
 */
export type CostFieldMode = 'edit' | 'read' | 'hidden';

export function costFieldMode({
  canRead,
  canUpdate,
}: {
  canRead: boolean;
  canUpdate: boolean;
}): CostFieldMode {
  if (!canRead) return 'hidden';
  return canUpdate ? 'edit' : 'read';
}

export interface CatalogFeatures {
  priceTiers: boolean;
  configurableOptions: boolean;
}

/** Product mutation input; `tiers` may be omitted to leave stored tiers untouched. */
export type ProductPayload = Omit<UpdateProductInput, 'tiers'> & { tiers?: PriceTierInput[] };

const blankToUndefined = (value: string | undefined) => (value?.trim() ? value : undefined);

export type DetailTab = 'details' | 'prices';

export function buildProductPayload(
  values: ProductFormValues,
  {
    tiers,
    priceTiersEnabled,
    unitsEnabled = true,
    costMode = 'hidden',
  }: {
    tiers: PriceTierInput[];
    priceTiersEnabled: boolean;
    unitsEnabled?: boolean;
    costMode?: CostFieldMode;
  },
): ProductPayload {
  return {
    name: values.name,
    shortDescription: blankToUndefined(values.shortDescription),
    longDescription: blankToUndefined(values.longDescription),
    isPremium: values.isPremium ?? false,
    price: values.price ?? null,
    // Without the units add-on the API keeps the stored unit (or the default one on create).
    ...(unitsEnabled ? { uomId: values.uomId } : {}),
    sku: values.sku ?? null,
    categoryId: values.categoryId ?? null,
    minQuantity: values.minQuantity,
    // Stored tiers are kept untouched while the add-on is off; the API rejects any tiers then.
    ...(priceTiersEnabled ? { tiers } : {}),
    // The API rejects a cost from a caller who may not edit it; omitted keeps the stored one.
    ...(costMode === 'edit' ? { cost: values.cost ?? null } : {}),
  };
}

/** Filter value for the products that have no category. */
export const NO_CATEGORY = 'none';

export function filterByCategory<T extends { categoryId: string | null }>(
  products: readonly T[],
  filter: string | undefined,
): T[] {
  if (!filter) return [...products];
  if (filter === NO_CATEGORY) return products.filter((p) => p.categoryId === null);
  return products.filter((p) => p.categoryId === filter);
}

/** Categories to filter the catalog by: the active ones and those its products still have. */
export function categoryFilterOptions(
  products: readonly { category: { id: string; name: string } | null }[],
  active: readonly { id: string; name: string }[],
): { value: string; label: string }[] {
  const byId = new Map<string, string>();
  for (const category of active) byId.set(category.id, category.name);
  for (const { category } of products) if (category) byId.set(category.id, category.name);
  return [...byId]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Full order after dragging inside a filtered list: the visible products take, in their new
 * order, the positions they already held, and the hidden ones stay where they were.
 */
export function mergeReorder(allIds: readonly string[], visibleIds: readonly string[]): string[] {
  const visible = new Set(visibleIds);
  const next = [...visibleIds];
  return allIds.map((id) => (visible.has(id) ? next.shift()! : id));
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
