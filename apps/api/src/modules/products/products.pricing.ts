// A product can be put on a quote when it has a per-unit price, or when the price-tiers add-on is
// active and the product has at least one tier.
export function isQuotable(
  product: { price: number | null },
  tiers: readonly unknown[],
  priceTiersActive: boolean,
): boolean {
  return product.price != null || (priceTiersActive && tiers.length > 0);
}
