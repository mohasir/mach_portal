interface QuotableProduct {
  quotable: boolean;
  /** Cents per unit. */
  price: number | null;
  priceTiers: { quantity: number; price: number }[];
}

export const lineSubtotalForQuantity = (
  unitPrice: number | null,
  quantity: number,
  currentSubtotal: number,
) => (unitPrice == null ? currentSubtotal : unitPrice * quantity);

export const usesTierPicker = (
  product: Pick<QuotableProduct, 'priceTiers'>,
  priceTiersEnabled: boolean,
) => priceTiersEnabled && product.priceTiers.length > 0;

// Without a fixed price and without a tier picker the quantity cannot move the subtotal, so
// editing it would silently desync the line from its product; the price stays manual.
export const isQuantityLocked = (product: QuotableProduct, priceTiersEnabled: boolean) =>
  !product.quotable || (product.price == null && !usesTierPicker(product, priceTiersEnabled));

export function buildNewLine(
  product: QuotableProduct,
  { priceTiersEnabled, minPersons }: { priceTiersEnabled: boolean; minPersons: number },
): { quantity: number; subtotal: number } | null {
  if (!product.quotable) return null;
  if (usesTierPicker(product, priceTiersEnabled)) {
    const first = product.priceTiers[0]!;
    return { quantity: first.quantity, subtotal: first.price };
  }
  if (product.price == null) return null;
  return { quantity: minPersons, subtotal: product.price * minPersons };
}

export function getPickerState(product: Pick<QuotableProduct, 'quotable'>) {
  return product.quotable
    ? { selectable: true as const }
    : { selectable: false as const, reasonKey: 'builder.lines.notQuotable' as const };
}
