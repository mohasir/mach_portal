import { describe, expect, it } from 'vitest';
import {
  buildProductPayload,
  categoryFilterOptions,
  costFieldMode,
  filterByCategory,
  getDetailTabs,
  getNotQuotableHintKey,
  isNotQuotable,
  mergeReorder,
  NO_CATEGORY,
} from '../helpers';

const tiers = [{ quantity: 50, price: 10000 }];
const values = {
  name: 'Taco bar',
  shortDescription: 'x',
  isPremium: true,
  uomId: 'unit-1',
  minQuantity: 1,
};

describe('buildProductPayload', () => {
  it('omits tiers when priceTiers is off so the API does not reject them', () => {
    const payload = buildProductPayload(
      { ...values, price: 500 },
      { tiers, priceTiersEnabled: false },
    );
    expect(payload).not.toHaveProperty('tiers');
    expect(payload.price).toBe(500);
  });

  it('sends the stored tiers when priceTiers is on', () => {
    const payload = buildProductPayload(values, { tiers, priceTiersEnabled: true });
    expect(payload.tiers).toEqual(tiers);
  });

  it('turns an empty price into null', () => {
    expect(
      buildProductPayload({ ...values, price: undefined }, { tiers, priceTiersEnabled: true })
        .price,
    ).toBeNull();
    expect(
      buildProductPayload({ ...values, price: null }, { tiers, priceTiersEnabled: true }).price,
    ).toBeNull();
  });

  it('keeps a zero price', () => {
    expect(
      buildProductPayload({ ...values, price: 0 }, { tiers, priceTiersEnabled: false }).price,
    ).toBe(0);
  });

  it('sends the chosen unit', () => {
    expect(buildProductPayload(values, { tiers, priceTiersEnabled: false }).uomId).toBe('unit-1');
  });

  it('defaults isPremium to false', () => {
    const payload = buildProductPayload(
      { name: 'a', isPremium: undefined as unknown as boolean, uomId: 'unit-1', minQuantity: 1 },
      { tiers: [], priceTiersEnabled: false },
    );
    expect(payload.isPremium).toBe(false);
  });
});

describe('buildProductPayload with SKU, category, minimum and cost', () => {
  const off = { tiers, priceTiersEnabled: false };

  it('sends the SKU, the category (null without one) and the minimum quantity', () => {
    const payload = buildProductPayload(
      { ...values, sku: 'AB-1', categoryId: 'cat-1', minQuantity: 25 },
      off,
    );
    expect(payload).toMatchObject({ sku: 'AB-1', categoryId: 'cat-1', minQuantity: 25 });
    const empty = buildProductPayload({ ...values, sku: undefined, categoryId: undefined }, off);
    expect(empty).toMatchObject({ sku: null, categoryId: null });
  });

  it('sends the cost only when the caller may edit it', () => {
    const withCost = { ...values, cost: 1200 };
    expect(buildProductPayload(withCost, { ...off, costMode: 'edit' }).cost).toBe(1200);
    expect(buildProductPayload({ ...values }, { ...off, costMode: 'edit' }).cost).toBeNull();
    for (const costMode of ['read', 'hidden'] as const) {
      expect(buildProductPayload(withCost, { ...off, costMode })).not.toHaveProperty('cost');
    }
    expect(buildProductPayload(withCost, off)).not.toHaveProperty('cost');
  });
});

describe('buildProductPayload descriptions', () => {
  const off = { tiers, priceTiersEnabled: false };

  it('sends both descriptions as written', () => {
    const payload = buildProductPayload(
      { ...values, shortDescription: '**Short**', longDescription: '## Long\n\n- item' },
      off,
    );
    expect(payload).toMatchObject({
      shortDescription: '**Short**',
      longDescription: '## Long\n\n- item',
    });
    expect(payload).not.toHaveProperty('description');
  });

  it('sends an empty or blank description as undefined', () => {
    for (const blank of ['', '   ', '\n', undefined]) {
      const payload = buildProductPayload(
        { ...values, shortDescription: blank, longDescription: blank },
        off,
      );
      expect(payload.shortDescription).toBeUndefined();
      expect(payload.longDescription).toBeUndefined();
    }
  });
});

describe('costFieldMode', () => {
  it('edits with read and update, shows with read only and hides otherwise', () => {
    expect(costFieldMode({ canRead: true, canUpdate: true })).toBe('edit');
    expect(costFieldMode({ canRead: true, canUpdate: false })).toBe('read');
    expect(costFieldMode({ canRead: false, canUpdate: false })).toBe('hidden');
    // Without read the stored cost is unknown, so the form would overwrite it blindly.
    expect(costFieldMode({ canRead: false, canUpdate: true })).toBe('hidden');
  });
});

describe('filterByCategory', () => {
  const products = [
    { id: 'a', categoryId: 'c1' },
    { id: 'b', categoryId: null },
    { id: 'c', categoryId: 'c2' },
  ];

  it('keeps every product without a filter', () => {
    expect(filterByCategory(products, undefined)).toEqual(products);
  });

  it('keeps the products of a category, or those without one', () => {
    expect(filterByCategory(products, 'c1').map((p) => p.id)).toEqual(['a']);
    expect(filterByCategory(products, NO_CATEGORY).map((p) => p.id)).toEqual(['b']);
  });
});

describe('categoryFilterOptions', () => {
  it('offers the active categories and the inactive ones that still have products, by name', () => {
    const products = [
      { category: { id: 'old', name: 'Antigua' } },
      { category: null },
      { category: { id: 'b', name: 'Bebidas' } },
    ];
    const active = [
      { id: 'p', name: 'Postres' },
      { id: 'b', name: 'Bebidas' },
    ];
    expect(categoryFilterOptions(products, active)).toEqual([
      { value: 'old', label: 'Antigua' },
      { value: 'b', label: 'Bebidas' },
      { value: 'p', label: 'Postres' },
    ]);
  });
});

describe('mergeReorder', () => {
  it('returns the reordered list when nothing is filtered', () => {
    expect(mergeReorder(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('moves the visible products inside the slots they held in the full list', () => {
    expect(mergeReorder(['a', 'x', 'b', 'y', 'c'], ['c', 'a', 'b'])).toEqual([
      'c',
      'x',
      'a',
      'y',
      'b',
    ]);
  });
});

describe('getDetailTabs', () => {
  it('shows only the sections of active add-ons', () => {
    expect(getDetailTabs({ priceTiers: false, configurableOptions: false })).toEqual([]);
    expect(getDetailTabs({ priceTiers: true, configurableOptions: false })).toEqual(['prices']);
    expect(getDetailTabs({ priceTiers: false, configurableOptions: true })).toEqual(['details']);
    expect(getDetailTabs({ priceTiers: true, configurableOptions: true })).toEqual([
      'details',
      'prices',
    ]);
  });
});

describe('isNotQuotable', () => {
  it('is true only for an explicit quotable=false', () => {
    expect(isNotQuotable({ quotable: false })).toBe(true);
    expect(isNotQuotable({ quotable: true })).toBe(false);
  });
});

describe('getNotQuotableHintKey', () => {
  it('asks for a fixed price, or a price or tiers when tiers are available', () => {
    expect(getNotQuotableHintKey(false)).toBe('product.notQuotable.hintFixedPrice');
    expect(getNotQuotableHintKey(true)).toBe('product.notQuotable.hintPriceOrTiers');
  });
});
