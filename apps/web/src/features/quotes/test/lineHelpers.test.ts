import { describe, expect, it } from 'vitest';
import {
  buildNewLine,
  getPickerState,
  isQuantityLocked,
  lineMinQuantity,
  lineSubtotalForQuantity,
  selectableTiers,
  usesTierPicker,
} from '../lineHelpers';

const tiered = {
  quotable: true,
  price: null,
  minQuantity: 1,
  priceTiers: [
    { quantity: 100, price: 20000 },
    { quantity: 50, price: 12000 },
  ],
};
const flat = { quotable: true, price: 350, minQuantity: 10, priceTiers: [] };
const notQuotable = { quotable: false, price: null, minQuantity: 1, priceTiers: [] };

describe('lineSubtotalForQuantity', () => {
  it('multiplies the per-unit price by the quantity in cents', () => {
    expect(lineSubtotalForQuantity(350, 40, 1)).toBe(14000);
  });

  it('keeps the current subtotal when the product has no fixed price', () => {
    expect(lineSubtotalForQuantity(null, 40, 999)).toBe(999);
  });
});

describe('usesTierPicker', () => {
  it('needs the add-on and at least one tier', () => {
    expect(usesTierPicker(tiered, true)).toBe(true);
    expect(usesTierPicker(tiered, false)).toBe(false);
    expect(usesTierPicker(flat, true)).toBe(false);
  });
});

describe('buildNewLine', () => {
  it('starts on the first tier with the add-on on', () => {
    expect(buildNewLine(tiered, { priceTiersEnabled: true })).toEqual({
      quantity: 100,
      subtotal: 20000,
    });
  });

  it('uses price x the product minimum quantity without the add-on', () => {
    expect(buildNewLine(flat, { priceTiersEnabled: false })).toEqual({
      quantity: 10,
      subtotal: 3500,
    });
  });

  it('falls back to the fixed price when the add-on is on but the product has no tiers', () => {
    expect(buildNewLine({ ...flat, minQuantity: 20 }, { priceTiersEnabled: true })).toEqual({
      quantity: 20,
      subtotal: 7000,
    });
  });

  it('starts on the first tier that reaches the product minimum', () => {
    expect(buildNewLine({ ...tiered, minQuantity: 60 }, { priceTiersEnabled: true })).toEqual({
      quantity: 100,
      subtotal: 20000,
    });
  });

  it('returns null for a product that cannot be quoted', () => {
    expect(buildNewLine(notQuotable, { priceTiersEnabled: true })).toBeNull();
    expect(buildNewLine(tiered, { priceTiersEnabled: false })).toBeNull();
  });
});

describe('selectableTiers', () => {
  it('leaves out the tiers below the product minimum quantity', () => {
    expect(selectableTiers({ ...tiered, minQuantity: 60 })).toEqual([
      { quantity: 100, price: 20000 },
    ]);
    expect(selectableTiers({ ...tiered, minQuantity: 50 })).toHaveLength(2);
  });

  it('turns off the tier picker when no tier reaches the minimum', () => {
    expect(usesTierPicker({ ...tiered, minQuantity: 500 }, true)).toBe(false);
    expect(isQuantityLocked({ ...tiered, minQuantity: 500 }, true)).toBe(true);
  });
});

describe('getPickerState', () => {
  it('is selectable when quotable', () => {
    expect(getPickerState(flat)).toEqual({ selectable: true });
  });

  it('is disabled with a reason key when not quotable', () => {
    expect(getPickerState(notQuotable)).toEqual({
      selectable: false,
      reasonKey: 'builder.lines.notQuotable',
    });
  });
});

describe('isQuantityLocked', () => {
  it('is unlocked for a flat-priced product', () => {
    expect(isQuantityLocked(flat, false)).toBe(false);
  });

  it('is unlocked for a tiered product while the tier picker is in use', () => {
    expect(isQuantityLocked(tiered, true)).toBe(false);
  });

  it('is locked for a product that is not quotable', () => {
    expect(isQuantityLocked(notQuotable, true)).toBe(true);
    expect(isQuantityLocked({ ...flat, quotable: false }, false)).toBe(true);
  });

  it('is locked when there is no price and no tier picker is shown', () => {
    expect(isQuantityLocked({ ...tiered, quotable: true }, false)).toBe(true);
    expect(
      isQuantityLocked({ quotable: true, price: null, minQuantity: 1, priceTiers: [] }, true),
    ).toBe(true);
  });
});

describe('lineMinQuantity', () => {
  it('is the product minimum, or 1 for whoever manages line pricing', () => {
    expect(lineMinQuantity(flat, false)).toBe(10);
    expect(lineMinQuantity(flat, true)).toBe(1);
  });
});
