import { describe, expect, it } from 'vitest';
import type { QuoteLineInput } from '@repo/schemas';
import { changedLines } from '../quotes.validation';

const units = new Map([['p1', 'u1']]);

const line = (over: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
  productId: 'p1',
  quantity: 40,
  subtotal: 200,
  selections: [],
  ...over,
});
const stored = (over: Partial<QuoteLineInput> = {}) => line({ uomId: 'u1', ...over });

describe('changedLines', () => {
  it('skips a submitted line identical to a stored one', () => {
    expect(changedLines([line()], [stored()], units)).toEqual([]);
  });

  it('flags a line whose product, quantity, subtotal or selections differ', () => {
    const base = [stored({ selections: [{ optionGroupId: 'g', optionIds: ['a'] }] })];
    expect(changedLines([line({ productId: 'p2' })], base, units)).toHaveLength(1);
    expect(changedLines([line({ quantity: 50 })], base, units)).toHaveLength(1);
    expect(changedLines([line({ subtotal: 1 })], base, units)).toHaveLength(1);
    expect(changedLines([line()], base, units)).toHaveLength(1);
  });

  it('ignores the order of selections, groups and options', () => {
    const base = [
      stored({
        selections: [
          { optionGroupId: 'g1', optionIds: ['a', 'b'] },
          { optionGroupId: 'g2', optionIds: ['c'] },
        ],
      }),
    ];
    const submitted = line({
      selections: [
        { optionGroupId: 'g2', optionIds: ['c'] },
        { optionGroupId: 'g1', optionIds: ['b', 'a'] },
      ],
    });
    expect(changedLines([submitted], base, units)).toEqual([]);
  });

  it('treats a group with no chosen option like an absent one', () => {
    const submitted = line({ selections: [{ optionGroupId: 'g', optionIds: [] }] });
    expect(changedLines([submitted], [stored()], units)).toEqual([]);
  });

  it('lets each stored line excuse at most one submitted line', () => {
    const extra = line();
    expect(changedLines([line(), extra], [stored()], units)).toEqual([extra]);
    expect(changedLines([line(), line()], [stored(), stored()], units)).toEqual([]);
  });

  it('reads a line without a unit in the current unit of its product', () => {
    const moved = new Map([['p1', 'u2']]);
    expect(changedLines([line()], [stored()], moved)).toHaveLength(1);
  });

  it('keeps a line that resends its stored unit unchanged even after the product moved', () => {
    const moved = new Map([['p1', 'u2']]);
    expect(changedLines([line({ uomId: 'u1' })], [stored()], moved)).toEqual([]);
  });

  it('flags a line that sends a different unit than the stored one', () => {
    expect(changedLines([line({ uomId: 'u2' })], [stored()], units)).toHaveLength(1);
  });
});
