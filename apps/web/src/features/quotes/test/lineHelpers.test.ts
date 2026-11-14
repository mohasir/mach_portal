import { describe, expect, it } from 'vitest';
import {
  buildNewLine,
  getPickerState,
  isQuantityLocked,
  lineSubtotalForQuantity,
  usesTierPicker,
} from '../lineHelpers';

const tiered = {
  quotable: true,
  price: null,
  priceTiers: [
    { numPersons: 100, price: 20000 },
    { numPersons: 50, price: 12000 },
  ],
};
const flat = { quotable: true, price: 350, priceTiers: [] };
const notQuotable = { quotable: false, price: null, priceTiers: [] };

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
    expect(buildNewLine(tiered, { priceTiersEnabled: true, minPersons: 10 })).toEqual({
      numPersons: 100,
      subtotal: 20000,
    });
  });

  it('uses price x minimum quantity without the add-on', () => {
    expect(buildNewLine(flat, { priceTiersEnabled: false, minPersons: 10 })).toEqual({
      numPersons: 10,
      subtotal: 3500,
    });
  });

  it('falls back to the fixed price when the add-on is on but the product has no tiers', () => {
    expect(buildNewLine(flat, { priceTiersEnabled: true, minPersons: 20 })).toEqual({
      numPersons: 20,
      subtotal: 7000,
    });
  });

  it('returns null for a product that cannot be quoted', () => {
    expect(buildNewLine(notQuotable, { priceTiersEnabled: true, minPersons: 10 })).toBeNull();
    expect(buildNewLine(tiered, { priceTiersEnabled: false, minPersons: 10 })).toBeNull();
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
    expect(isQuantityLocked({ quotable: true, price: null, priceTiers: [] }, true)).toBe(true);
  });
});
