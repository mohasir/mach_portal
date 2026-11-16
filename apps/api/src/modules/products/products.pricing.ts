// A product can be put on a quote when it has a per-unit price, or when the price-tiers add-on is
// active and the product has at least one tier that reaches its minimum quantity (a smaller tier
// would be rejected as a quote line).
export function isQuotable(
  product: { price: number | null; minQuantity: number },
  tiers: readonly { quantity: number }[],
  priceTiersActive: boolean,
): boolean {
  return (
    product.price != null ||
    (priceTiersActive && tiers.some((tier) => tier.quantity >= product.minQuantity))
  );
}
