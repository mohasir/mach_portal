import { describe, expect, it } from 'vitest';
import type { ProductWithGroups } from '../../products/products.resource';
import { buildQuotePdfPayload } from '../quotes.pdf';
import type { QuoteDetailRow, QuoteLineDetail } from '../quotes.resource';

const option = (id: string, name: string, isActive = true) => ({
  id,
  optionGroupId: 'g',
  name,
  description: null as string | null,
  isActive,
  sortOrder: 0,
});

const group = (
  id: string,
  label: string,
  options: ReturnType<typeof option>[],
  isActive = true,
) => ({
  id,
  productId: 'p1',
  label,
  selectionType: 'select' as const,
  maxSelect: null,
  isActive,
  sortOrder: 0,
  options,
});

const product = (
  optionGroups: ProductWithGroups['optionGroups'],
  isActive = true,
): ProductWithGroups => ({
  id: 'p1',
  name: 'Taco Bar',
  description: null,
  isPremium: false,
  isActive,
  sortOrder: 0,
  price: null,
  uomId: 'u1',
  unit: { id: 'u1', name: 'Persona', pluralName: 'Personas', code: 'pers', dimension: 'quantity' },
  categoryId: null,
  category: null,
  sku: null,
  minQuantity: 1,
  images: [],
  quotable: false,
  priceTiers: [],
  optionGroups,
});

const quoteRow = {
  number: 'Q-1',
  clientName: 'Client',
  longDistanceAmount: 0,
  taxAmount: 0,
  cardSurchargeAmount: 0,
  depositAmount: 0,
} as unknown as QuoteDetailRow;

const lines = [{ productId: 'p1', quantity: 20, subtotal: 100000 }] as unknown as QuoteLineDetail[];

const detailsOf = (catalog: ProductWithGroups[]) =>
  buildQuotePdfPayload(quoteRow, lines, catalog, undefined).items[0]?.details;

describe('buildQuotePdfPayload menu', () => {
  it('omits inactive options from a group', () => {
    const details = detailsOf([
      product([group('g1', 'Proteins', [option('o1', 'Chicken'), option('o2', 'Beef', false)])]),
    ]);
    expect(details).toEqual([expect.objectContaining({ options: ['Chicken'] })]);
  });

  it('omits an inactive group together with its options', () => {
    const details = detailsOf([
      product([
        group('g1', 'Proteins', [option('o1', 'Chicken')]),
        group('g2', 'Sides', [option('o2', 'Rice')], false),
      ]),
    ]);
    expect(details).toHaveLength(1);
    expect(details?.[0]?.title).toBe('Proteins');
  });

  it('still lists an inactive product so existing quotes keep their line', () => {
    const items = buildQuotePdfPayload(
      quoteRow,
      lines,
      [product([group('g1', 'Proteins', [option('o1', 'Chicken')])], false)],
      undefined,
    ).items;
    expect(items).toHaveLength(1);
    expect(items[0]?.details).toEqual([expect.objectContaining({ options: ['Chicken'] })]);
  });

  it('picks no icon from the product or group name', () => {
    const details = detailsOf([
      product([
        group('g1', 'Fresh Fruits', [option('o1', 'Mango')]),
        group('g2', 'Warm Cheese Sauce', [option('o2', 'Cheddar')]),
      ]),
    ]);
    expect(details).toEqual([
      { title: 'Fresh Fruits', options: ['Mango'] },
      { title: 'Warm Cheese Sauce', options: ['Cheddar'] },
    ]);
  });

  it('lays out a group the same way whatever the product and group are called', () => {
    const cocktail = { ...option('o1', 'Paloma'), description: 'Tequila • Grapefruit' };
    const details = detailsOf([
      { ...product([group('g1', 'Signature Cocktails', [cocktail])]), name: 'Craft Bar' },
    ]);
    expect(details).toEqual([{ title: 'Signature Cocktails', options: ['Paloma'] }]);
  });
});
