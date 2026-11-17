import { describe, expect, it } from 'vitest';
import { computeQuoteTotals, normalizeChargeValue } from '@repo/schemas';
import { fromPercent } from '@/lib/utils/percent';
import { computeBuilderTotals, taxSummaryRows } from '../builderTotals';
import { emptyBuilderState, type LineDraft } from '../quotes.store';

const catalog = [
  { id: 'food', uomId: 'u', taxRate: 0.1, taxExempt: false },
  { id: 'rental', uomId: 'u', taxRate: 0.0875, taxExempt: false },
  { id: 'exempt', uomId: 'u', taxRate: 0.1, taxExempt: true },
];

const line = (key: string, productId: string, subtotal: number): LineDraft => ({
  key,
  productId,
  quantity: 1,
  subtotal,
  selections: {},
});

const state = {
  ...emptyBuilderState(0.5),
  lines: [line('a', 'food', 10001), line('b', 'rental', 3333), line('c', 'exempt', 2500)],
  discountType: 'percent' as const,
  discountValue: 0.1,
  charges: [
    { chargeTypeId: 't1', name: 'Traslado', kind: 'fixed' as const, value: 5000 },
    { chargeTypeId: 't2', name: 'Tarjeta', kind: 'percent' as const, value: 0.03 },
  ],
};

describe('computeBuilderTotals', () => {
  it('matches computeQuoteTotals with mixed rates, an exempt line, a discount and charges', () => {
    const { totals } = computeBuilderTotals(state, emptyBuilderState(0.5), catalog, true);
    expect(totals).toEqual(
      computeQuoteTotals({
        lines: [
          { subtotal: 10001, taxRate: 0.1 },
          { subtotal: 3333, taxRate: 0.0875 },
          { subtotal: 2500, taxRate: 0 },
        ],
        discountType: 'percent',
        discountValue: 0.1,
        charges: [
          { kind: 'fixed', value: 5000 },
          { kind: 'percent', value: 0.03 },
        ],
        depositRate: 0.5,
      }),
    );
    expect(totals.taxBreakdown.map((b) => b.taxRate)).toEqual([0, 0.0875, 0.1]);
  });

  it('prices a percent typed in the builder exactly as the API saves it', () => {
    // 0.007% read as 0.007 / 100 is one ulp above the 5-decimal rate the API stores, which moves
    // this amount by a cent unless the preview rounds the rate the same way.
    const rate = fromPercent(0.007);
    const typed = {
      ...emptyBuilderState(0.5),
      lines: [line('a', 'exempt', 50000)],
      charges: [{ chargeTypeId: 't2', name: 'Tarjeta', kind: 'percent' as const, value: rate }],
    };
    const { totals } = computeBuilderTotals(typed, emptyBuilderState(0.5), catalog, true);
    const saved = computeQuoteTotals({
      lines: [{ subtotal: 50000, taxRate: 0 }],
      charges: [{ kind: 'percent', value: normalizeChargeValue('percent', rate) }],
      depositRate: 0.5,
    });
    expect(totals.charges).toEqual(saved.charges);
    expect(totals.total).toBe(saved.total);
  });

  it('pairs each charge with its amount', () => {
    const { chargeRows } = computeBuilderTotals(state, emptyBuilderState(0.5), catalog, true);
    expect(chargeRows.map((c) => [c.name, c.amount])).toEqual([
      ['Traslado', 5000],
      ['Tarjeta', expect.any(Number)],
    ]);
    expect(chargeRows[1]!.amount).toBeGreaterThan(0);
  });

  it('keeps charges of a quote saved with the add-on that is now off', () => {
    const on = computeBuilderTotals(state, emptyBuilderState(0.5), catalog, true).totals.total;
    const off = computeBuilderTotals(state, emptyBuilderState(0.5), catalog, false).totals.total;
    expect(off).toBe(on);
  });

  it('keeps the frozen rate of a saved line in the total', () => {
    const saved = { ...line('a', 'food', 1000), taxRate: 0.05 };
    const initial = { ...emptyBuilderState(0.5), lines: [saved] };
    const { totals } = computeBuilderTotals(
      { ...initial, lines: [saved] },
      initial,
      catalog,
      false,
    );
    expect(totals.taxAmount).toBe(50);
  });
});

describe('taxSummaryRows', () => {
  it('hides rates that add no tax and keeps the plain tax row', () => {
    expect(
      taxSummaryRows([
        { taxRate: 0, taxAmount: 0 },
        { taxRate: 0.1, taxAmount: 100 },
        { taxRate: null, taxAmount: 9 },
      ]),
    ).toEqual([
      { taxRate: 0.1, taxAmount: 100 },
      { taxRate: null, taxAmount: 9 },
    ]);
  });
});
