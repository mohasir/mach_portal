import { describe, expect, it } from 'vitest';
import type { QuoteLineInput } from '@repo/schemas';
import { changedLines } from '../quotes.validation';

const line = (over: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
  productId: 'p1',
  quantity: 40,
  subtotal: 200,
  selections: [],
  ...over,
});

describe('changedLines', () => {
  it('skips a submitted line identical to a stored one', () => {
    expect(changedLines([line()], [line()])).toEqual([]);
  });

  it('flags a line whose product, quantity, subtotal or selections differ', () => {
    const stored = [line({ selections: [{ optionGroupId: 'g', optionIds: ['a'] }] })];
    expect(changedLines([line({ productId: 'p2' })], stored)).toHaveLength(1);
    expect(changedLines([line({ quantity: 50 })], stored)).toHaveLength(1);
    expect(changedLines([line({ subtotal: 1 })], stored)).toHaveLength(1);
    expect(changedLines([line()], stored)).toHaveLength(1);
  });

  it('ignores the order of selections, groups and options', () => {
    const stored = [
      line({
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
    expect(changedLines([submitted], stored)).toEqual([]);
  });

  it('treats a group with no chosen option like an absent one', () => {
    const submitted = line({ selections: [{ optionGroupId: 'g', optionIds: [] }] });
    expect(changedLines([submitted], [line()])).toEqual([]);
  });

  it('lets each stored line excuse at most one submitted line', () => {
    const extra = line();
    expect(changedLines([line(), extra], [line()])).toEqual([extra]);
    expect(changedLines([line(), line()], [line(), line()])).toEqual([]);
  });
});
