import { describe, expect, it } from 'vitest';
import {
  buildProductPayload,
  getDetailTabs,
  getNotQuotableHintKey,
  isNotQuotable,
} from '../helpers';

const tiers = [{ quantity: 50, price: 10000 }];
const values = { name: 'Taco bar', description: 'x', isPremium: true, uomId: 'unit-1' };

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
      { name: 'a', isPremium: undefined as unknown as boolean, uomId: 'unit-1' },
      { tiers: [], priceTiersEnabled: false },
    );
    expect(payload.isPremium).toBe(false);
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
