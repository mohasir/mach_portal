import { describe, expect, it } from 'vitest';
import type { QuoteLineInput } from '@repo/schemas';
import type { QuotesRepository } from '../quotes.repository';
import { QuotesService } from '../quotes.service';
import type { CatalogContext } from '../quotes.validation';

const PRODUCT = 'p1';
const tier40 = { productId: PRODUCT, quantity: 40, price: 150 };

function catalog(
  price: number | null,
  tiers: CatalogContext['tiers'] = [],
  isActive = true,
  minQuantity = 1,
): CatalogContext {
  return {
    products: [{ id: PRODUCT, isActive, price, minQuantity }],
    tiers,
    groups: [],
    options: [],
  };
}

function validate(
  ctx: CatalogContext,
  line: Partial<QuoteLineInput>,
  manager: boolean,
  tiersOn: boolean,
) {
  const repo = {
    loadCatalogContext: async () => ctx,
    findProductUnits: async () => new Map<string, string>(),
  } as unknown as QuotesRepository;
  const service = new QuotesService(
    repo,
    {} as never,
    {} as never,
    {} as never,
    () => undefined,
    tiersOn,
    true,
    true,
  );
  const lines = [{ productId: PRODUCT, quantity: 40, subtotal: 200, selections: [], ...line }];
  return (
    service as unknown as { validateLines: (l: unknown[], m: boolean) => Promise<void> }
  ).validateLines(lines, manager);
}

describe('quote line validation with a fixed price', () => {
  it('accepts price x quantity without the tiers add-on', async () => {
    await expect(validate(catalog(5), { subtotal: 200 }, false, false)).resolves.toBeUndefined();
  });

  it('rejects any other subtotal with PRICING_NOT_ALLOWED', async () => {
    await expect(validate(catalog(5), { subtotal: 199 }, false, false)).rejects.toMatchObject({
      cause: { code: 'QUOTE_PRICING_NOT_ALLOWED' },
    });
  });

  it('rejects a product without price or tiers for everyone', async () => {
    for (const manager of [false, true]) {
      await expect(validate(catalog(null), {}, manager, false)).rejects.toMatchObject({
        cause: { code: 'PRODUCT_NOT_QUOTABLE' },
      });
    }
  });

  it('rejects a product whose only tiers are inactive for the add-on', async () => {
    await expect(
      validate(catalog(null, [tier40]), { subtotal: 150 }, true, false),
    ).rejects.toMatchObject({
      cause: { code: 'PRODUCT_NOT_QUOTABLE' },
    });
  });

  it('lets a manager set the subtotal by hand on a quotable product', async () => {
    await expect(validate(catalog(5), { subtotal: 1 }, true, false)).resolves.toBeUndefined();
  });
});

describe('quote line validation with price tiers', () => {
  it('accepts a matching tier when the add-on is active', async () => {
    await expect(
      validate(catalog(null, [tier40]), { subtotal: 150 }, false, true),
    ).resolves.toBeUndefined();
  });

  it('accepts both the tier and the fixed price when both apply', async () => {
    const ctx = catalog(5, [tier40]);
    await expect(validate(ctx, { subtotal: 150 }, false, true)).resolves.toBeUndefined();
    await expect(validate(ctx, { subtotal: 200 }, false, true)).resolves.toBeUndefined();
    await expect(validate(ctx, { subtotal: 199 }, false, true)).rejects.toMatchObject({
      cause: { code: 'QUOTE_PRICING_NOT_ALLOWED' },
    });
  });

  it('ignores a tier when the add-on is off unless it equals price x quantity', async () => {
    const ctx = catalog(5, [tier40]);
    await expect(validate(ctx, { subtotal: 150 }, false, false)).rejects.toMatchObject({
      cause: { code: 'QUOTE_PRICING_NOT_ALLOWED' },
    });
    const same = catalog(5, [{ ...tier40, price: 200 }]);
    await expect(validate(same, { subtotal: 200 }, false, false)).resolves.toBeUndefined();
  });
});

describe('quote line validation with the product minimum quantity', () => {
  const belowMin = catalog(5, [tier40], true, 41);

  it('rejects a quantity below the product minimum', async () => {
    await expect(validate(belowMin, { subtotal: 200 }, false, false)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      cause: { code: 'QUOTE_BELOW_MIN_QUANTITY' },
    });
    await expect(validate(belowMin, { subtotal: 150 }, false, true)).rejects.toMatchObject({
      cause: { code: 'QUOTE_BELOW_MIN_QUANTITY' },
    });
  });

  it('accepts a quantity equal to the minimum', async () => {
    await expect(
      validate(catalog(5, [], true, 40), { subtotal: 200 }, false, false),
    ).resolves.toBeUndefined();
  });

  it('lets a manager (manual pricing) quote below the minimum quantity', async () => {
    await expect(validate(belowMin, { subtotal: 1 }, true, false)).resolves.toBeUndefined();
  });

  it('flags a product as not quotable when no tier reaches its minimum and it has no price', async () => {
    const ctx = catalog(null, [tier40], true, 50);
    for (const manager of [false, true]) {
      await expect(
        validate(ctx, { quantity: 50, subtotal: 150 }, manager, true),
      ).rejects.toMatchObject({ cause: { code: 'PRODUCT_NOT_QUOTABLE' } });
    }
  });
});
