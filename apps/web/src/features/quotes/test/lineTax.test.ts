import { describe, expect, it } from 'vitest';
import { toBuilderState } from '../helpers';
import { lineTaxRates, productTaxRate } from '../lineHelpers';
import type { LineDraft } from '../quotes.store';
import type { QuoteDetail } from '../types';

const catalog = [
  { id: 'food', uomId: 'u-person', taxRate: 0.1, taxExempt: false },
  { id: 'rental', uomId: 'u-person', taxRate: 0.0875, taxExempt: false },
  { id: 'exempt', uomId: 'u-person', taxRate: 0.1, taxExempt: true },
];

const line = (over: Partial<LineDraft>): LineDraft => ({
  key: 'a',
  productId: 'food',
  quantity: 10,
  subtotal: 1000,
  selections: {},
  ...over,
});

describe('productTaxRate', () => {
  it('is the product rate, or zero when the product is exempt', () => {
    expect(productTaxRate(catalog[0]!)).toBe(0.1);
    expect(productTaxRate(catalog[2]!)).toBe(0);
  });
});

describe('lineTaxRates', () => {
  it('gives a new line the current rate of its product', () => {
    expect(lineTaxRates([line({}), line({ key: 'b', productId: 'exempt' })], [], catalog)).toEqual([
      0.1, 0,
    ]);
  });

  it('keeps the frozen rate of a saved line resent unchanged', () => {
    const saved = line({ taxRate: 0.05 });
    expect(lineTaxRates([saved], [saved], catalog)).toEqual([0.05]);
  });

  it('takes the current product rate once the quantity, price or selections change', () => {
    const saved = line({ taxRate: 0.05 });
    expect(lineTaxRates([{ ...saved, quantity: 11 }], [saved], catalog)).toEqual([0.1]);
    expect(lineTaxRates([{ ...saved, subtotal: 900 }], [saved], catalog)).toEqual([0.1]);
    expect(lineTaxRates([{ ...saved, selections: { g: ['o'] } }], [saved], catalog)).toEqual([0.1]);
  });

  it('keeps the frozen rate again when an edit is undone', () => {
    const saved = line({ taxRate: 0.05 });
    const restored = { ...saved, quantity: 11 };
    expect(lineTaxRates([{ ...restored, quantity: 10 }], [saved], catalog)).toEqual([0.05]);
  });

  it('treats a missing unit as the product current one, like the API', () => {
    const saved = line({ taxRate: 0.05, uomId: 'u-person' });
    expect(lineTaxRates([{ ...saved, uomId: undefined }], [saved], catalog)).toEqual([0.05]);
    const frozenElsewhere = line({ taxRate: 0.05, uomId: 'u-hour' });
    expect(
      lineTaxRates([{ ...frozenElsewhere, uomId: undefined }], [frozenElsewhere], catalog),
    ).toEqual([0.1]);
  });

  it('ignores the order of the selections', () => {
    const saved = line({ taxRate: 0.05, selections: { g1: ['a', 'b'], g2: ['c'] } });
    const reordered = { ...saved, selections: { g2: ['c'], g1: ['b', 'a'] } };
    expect(lineTaxRates([reordered], [saved], catalog)).toEqual([0.05]);
  });

  it('falls back to the frozen rate when the product is no longer in the catalog', () => {
    expect(lineTaxRates([line({ productId: 'gone', taxRate: 0.07 })], [], catalog)).toEqual([0.07]);
    expect(lineTaxRates([line({ productId: 'gone' })], [], catalog)).toEqual([0]);
  });
});

describe('toBuilderState tax', () => {
  it('keeps the frozen rate of every saved line', () => {
    const detail = {
      lines: [
        { id: 'l1', productId: 'food', quantity: 1, subtotal: 10, taxRate: 0.0875, selections: [] },
      ],
      charges: [],
    } as unknown as QuoteDetail;
    expect(toBuilderState(detail).lines[0]!.taxRate).toBe(0.0875);
  });
});
