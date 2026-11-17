import { describe, expect, it } from 'vitest';
import {
  allocateProportionally,
  computeQuoteTotals,
  summarizeLineTaxes,
  type QuoteTotalsInput,
} from '@repo/schemas';

const totals = (over: Partial<QuoteTotalsInput> = {}) =>
  computeQuoteTotals({ lines: [], depositRate: 0.5, ...over });

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// The single-rate cascade the quotes used before taxes moved to the lines.
const singleRateTotal = (subtotal: number, discount: number, rate: number) => {
  const base = subtotal - discount;
  return base + Math.round(base * rate);
};

describe('allocateProportionally', () => {
  it('splits exactly, giving the leftover cents to the largest remainders', () => {
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProportionally(10, [3333, 3333, 3334])).toEqual([3, 3, 4]);
    expect(allocateProportionally(7, [100])).toEqual([7]);
  });

  it('breaks an exact tie in favor of the earlier entry', () => {
    // 1518 × 3457 / 7590 and 1518 × 557 / 7590 both leave exactly 0.4, though floats disagree.
    expect(allocateProportionally(1518, [3457, 3576, 557])).toEqual([692, 715, 111]);
  });

  it('stays exact when amount × weight goes past the safe integer range', () => {
    const parts = allocateProportionally(2147483647, [2147483646, 1234567891, 987654321]);
    expect(parts).toEqual([1055376760, 606726046, 485380841]);
    expect(parts.every(Number.isInteger)).toBe(true);
  });

  it('refuses amounts and weights that are not safe integers', () => {
    expect(() => allocateProportionally(0.5, [1, 1])).toThrow(RangeError);
    expect(() => allocateProportionally(10, [1.5, 1])).toThrow(RangeError);
    expect(() => allocateProportionally(2 ** 53, [1])).toThrow(RangeError);
  });

  it('gives nothing when there is nothing to weigh', () => {
    expect(allocateProportionally(0, [5, 5])).toEqual([0, 0]);
    expect(allocateProportionally(10, [0, 0])).toEqual([0, 0]);
    expect(allocateProportionally(10, [])).toEqual([]);
  });
});

describe('computeQuoteTotals per line', () => {
  it('matches the single-rate cascade for lines at one rate without discount', () => {
    const result = totals({
      lines: [
        { subtotal: 333, taxRate: 0.08875 },
        { subtotal: 333, taxRate: 0.08875 },
        { subtotal: 333, taxRate: 0.08875 },
      ],
    });
    expect(result.subtotal).toBe(999);
    expect(result.taxAmount).toBe(Math.round(999 * 0.08875));
    expect(result.total).toBe(singleRateTotal(999, 0, 0.08875));
    expect(sum(result.lines.map((l) => l.taxAmount))).toBe(result.taxAmount);
  });

  it('matches the single-rate cascade with a discount too', () => {
    const result = totals({
      lines: [
        { subtotal: 90000, taxRate: 0.08875 },
        { subtotal: 45001, taxRate: 0.08875 },
      ],
      discountType: 'percent',
      discountValue: 0.105,
    });
    const discount = Math.round(135001 * 0.105);
    expect(result.discountAmount).toBe(discount);
    expect(result.total).toBe(singleRateTotal(135001, discount, 0.08875));
  });

  it('taxes each rate on its own lines', () => {
    const result = totals({
      lines: [
        { subtotal: 10000, taxRate: 0.16 },
        { subtotal: 5000, taxRate: 0.08 },
      ],
    });
    expect(result.lines.map((l) => l.taxAmount)).toEqual([1600, 400]);
    expect(result.taxAmount).toBe(2000);
    expect(result.total).toBe(17000);
  });

  it('leaves an exempt line untaxed', () => {
    const result = totals({
      lines: [
        { subtotal: 10000, taxRate: 0.1 },
        { subtotal: 7000, taxRate: 0 },
      ],
    });
    expect(result.lines.map((l) => l.taxAmount)).toEqual([1000, 0]);
    expect(result.total).toBe(18000);
  });

  it('spreads a fixed discount over the lines by net, exactly', () => {
    const result = totals({
      lines: [
        { subtotal: 1000, taxRate: 0.1 },
        { subtotal: 1000, taxRate: 0.1 },
        { subtotal: 1000, taxRate: 0 },
      ],
      discountType: 'fixed',
      discountValue: 100,
    });
    expect(result.lines.map((l) => l.discountShare)).toEqual([34, 33, 33]);
    expect(sum(result.lines.map((l) => l.discountShare))).toBe(100);
    // Taxed base: (1000 - 34) + (1000 - 33) = 1933 → round(193.3) = 193.
    expect(result.taxAmount).toBe(193);
    expect(result.total).toBe(3000 - 100 + 193);
  });

  it('spreads a percent discount with one line taking all of it', () => {
    const result = totals({
      lines: [{ subtotal: 999, taxRate: 0.07 }],
      discountType: 'percent',
      discountValue: 0.15,
    });
    expect(result.discountAmount).toBe(150);
    expect(result.lines).toEqual([{ discountShare: 150, taxAmount: Math.round(849 * 0.07) }]);
  });

  it('keeps the sums exact with mixed rates, an exempt line and leftover cents', () => {
    const result = totals({
      lines: [
        { subtotal: 3333, taxRate: 0.08875 },
        { subtotal: 3333, taxRate: 0.0635 },
        { subtotal: 3334, taxRate: 0 },
        { subtotal: 1, taxRate: 0.08875 },
      ],
      discountType: 'percent',
      discountValue: 0.333,
    });
    expect(sum(result.lines.map((l) => l.discountShare))).toBe(result.discountAmount);
    expect(sum(result.lines.map((l) => l.taxAmount))).toBe(result.taxAmount);
    expect(sum(result.taxBreakdown.map((b) => b.taxAmount))).toBe(result.taxAmount);
    expect(sum(result.taxBreakdown.map((b) => b.base))).toBe(
      result.subtotal - result.discountAmount,
    );
    expect(result.total).toBe(result.subtotal - result.discountAmount + result.taxAmount);
  });

  it('caps a discount larger than the subtotal', () => {
    const result = totals({
      lines: [
        { subtotal: 500, taxRate: 0.1 },
        { subtotal: 300, taxRate: 0.1 },
      ],
      discountType: 'fixed',
      discountValue: 5000,
    });
    expect(result.discountAmount).toBe(800);
    expect(result.lines).toEqual([
      { discountShare: 500, taxAmount: 0 },
      { discountShare: 300, taxAmount: 0 },
    ]);
    expect(result.total).toBe(0);
  });

  it('groups base and tax by rate', () => {
    const result = totals({
      lines: [
        { subtotal: 10000, taxRate: 0.16 },
        { subtotal: 2000, taxRate: 0 },
        { subtotal: 5000, taxRate: 0.16 },
      ],
    });
    expect(result.taxBreakdown).toEqual([
      { taxRate: 0, base: 2000, taxAmount: 0 },
      { taxRate: 0.16, base: 15000, taxAmount: 2400 },
    ]);
  });

  it('takes the deposit over the final total', () => {
    const result = totals({
      lines: [{ subtotal: 10001, taxRate: 0 }],
      depositRate: 0.5,
    });
    expect(result.depositAmount).toBe(Math.round(10001 * 0.5));
  });

  it('handles a quote without lines', () => {
    const result = totals({ discountType: 'fixed', discountValue: 100 });
    expect(result).toMatchObject({ subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 });
    expect(result.lines).toEqual([]);
    expect(result.taxBreakdown).toEqual([]);
  });
});

describe('computeQuoteTotals charges', () => {
  const line = { subtotal: 10000, taxRate: 0.1 };

  it('adds a fixed charge after tax, without taxing it', () => {
    const result = totals({ lines: [line], charges: [{ kind: 'fixed', value: 2500 }] });
    expect(result.taxAmount).toBe(1000);
    expect(result.charges).toEqual([{ amount: 2500 }]);
    expect(result.total).toBe(13500);
  });

  it('charges a percent on the total with tax, fixed charges left out of its base', () => {
    const result = totals({
      lines: [line],
      charges: [
        { kind: 'fixed', value: 2500 },
        { kind: 'percent', value: 0.05 },
      ],
    });
    expect(result.charges).toEqual([{ amount: 2500 }, { amount: 550 }]);
    expect(result.total).toBe(11000 + 2500 + 550);
  });

  it('takes every percent charge on the same base, without compounding them', () => {
    const result = totals({
      lines: [line],
      charges: [
        { kind: 'percent', value: 0.1 },
        { kind: 'percent', value: 0.03 },
      ],
    });
    expect(result.charges).toEqual([{ amount: 1100 }, { amount: 330 }]);
    expect(result.total).toBe(11000 + 1100 + 330);
  });

  it('rounds a percent charge to the cent', () => {
    const result = totals({
      lines: [{ subtotal: 999, taxRate: 0.08875 }],
      charges: [{ kind: 'percent', value: 0.03333 }],
    });
    const taxed = 999 + Math.round(999 * 0.08875);
    expect(result.charges).toEqual([{ amount: Math.round(taxed * 0.03333) }]);
  });

  it('applies the charges after the discount and takes the deposit over the final total', () => {
    const result = totals({
      lines: [line],
      discountType: 'fixed',
      discountValue: 1000,
      charges: [
        { kind: 'fixed', value: 101 },
        { kind: 'percent', value: 0.1 },
      ],
      depositRate: 0.5,
    });
    // (10000 - 1000) × 1.1 = 9900; 9900 + 101 + 990 = 10991.
    expect(result.total).toBe(10991);
    expect(result.depositAmount).toBe(Math.round(10991 * 0.5));
  });

  it('charges a fixed amount on a quote without lines', () => {
    const result = totals({ charges: [{ kind: 'fixed', value: 700 }] });
    expect(result).toMatchObject({ taxAmount: 0, total: 700, charges: [{ amount: 700 }] });
  });

  it('returns no charges when none are given', () => {
    expect(totals({ lines: [line] }).charges).toEqual([]);
  });
});

describe('summarizeLineTaxes', () => {
  it('groups the stored line taxes by rate', () => {
    expect(
      summarizeLineTaxes(
        [
          { taxRate: 0.1, taxAmount: 100 },
          { taxRate: 0, taxAmount: 0 },
          { taxRate: 0.1, taxAmount: 50 },
        ],
        150,
      ),
    ).toEqual([
      { taxRate: 0, taxAmount: 0 },
      { taxRate: 0.1, taxAmount: 150 },
    ]);
  });

  it('keeps stored quote tax that no line carries as an entry without rate', () => {
    expect(summarizeLineTaxes([], 9)).toEqual([{ taxRate: null, taxAmount: 9 }]);
    expect(summarizeLineTaxes([{ taxRate: 0.1, taxAmount: 100 }], 95)).toEqual([
      { taxRate: 0.1, taxAmount: 100 },
      { taxRate: null, taxAmount: -5 },
    ]);
  });
});
