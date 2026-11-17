import type { QuantityUnit } from '@/lib/format/quantity';

interface QuotableProduct {
  quotable: boolean;
  /** Cents per unit. */
  price: number | null;
  /** Smallest quantity a line may have, in the product's unit. */
  minQuantity: number;
  priceTiers: { quantity: number; price: number }[];
}

export const lineSubtotalForQuantity = (
  unitPrice: number | null,
  quantity: number,
  currentSubtotal: number,
) => (unitPrice == null ? currentSubtotal : unitPrice * quantity);

// Whoever manages line pricing may go below the product minimum; the API allows it too.
export const lineMinQuantity = (
  product: Pick<QuotableProduct, 'minQuantity'>,
  canEditPricing: boolean,
) => (canEditPricing ? 1 : product.minQuantity);

// A tier below the product minimum would be rejected by the API.
export const selectableTiers = (product: Pick<QuotableProduct, 'priceTiers' | 'minQuantity'>) =>
  product.priceTiers.filter((tier) => tier.quantity >= product.minQuantity);

export const usesTierPicker = (
  product: Pick<QuotableProduct, 'priceTiers' | 'minQuantity'>,
  priceTiersEnabled: boolean,
) => priceTiersEnabled && selectableTiers(product).length > 0;

// Without a fixed price and without a tier picker the quantity cannot move the subtotal, so
// editing it would silently desync the line from its product; the price stays manual.
export const isQuantityLocked = (product: QuotableProduct, priceTiersEnabled: boolean) =>
  !product.quotable || (product.price == null && !usesTierPicker(product, priceTiersEnabled));

export function buildNewLine(
  product: QuotableProduct,
  { priceTiersEnabled }: { priceTiersEnabled: boolean },
): { quantity: number; subtotal: number } | null {
  if (!product.quotable) return null;
  if (usesTierPicker(product, priceTiersEnabled)) {
    const first = selectableTiers(product)[0]!;
    return { quantity: first.quantity, subtotal: first.price };
  }
  if (product.price == null) return null;
  return { quantity: product.minQuantity, subtotal: product.price * product.minQuantity };
}

export function getPickerState(product: Pick<QuotableProduct, 'quotable'>) {
  return product.quotable
    ? { selectable: true as const }
    : { selectable: false as const, reasonKey: 'builder.lines.notQuotable' as const };
}

/** A saved line keeps the unit it was quoted in; a new one shows the product's current unit. */
export const lineUnit = (
  line: { unit?: QuantityUnit | null },
  product: { unit: QuantityUnit },
): QuantityUnit => line.unit ?? product.unit;

/**
 * Pricing and tiers are per product unit, so repricing a line stored in another unit would mix
 * units. Changing the quantity makes the line adopt the product's current unit (the server reads
 * a missing `uomId` as that); a price-only edit keeps the frozen unit.
 */
export function withCurrentUnitOnRepricing<T extends object>(
  line: { uomId?: string },
  product: { uomId: string },
  payload: T,
): T & { uomId?: undefined; unit?: undefined } {
  if (!('quantity' in payload) || !line.uomId || line.uomId === product.uomId) {
    return payload;
  }
  return { ...payload, uomId: undefined, unit: undefined };
}
