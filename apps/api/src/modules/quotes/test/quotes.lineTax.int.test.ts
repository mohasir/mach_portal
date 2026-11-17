import { beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import { createQuoteSchema, QUOTE_STAGE, type QuoteLineInput } from '@repo/schemas';
import {
  appSettings,
  clients,
  products,
  quoteLines,
  quoteStages,
  quotes,
} from '../../../db/schema';
import {
  addMember,
  createTestTenant,
  createTestUser,
  resetDb,
  testDb,
  testUnitId,
} from '../../../test/db';
import { ConfigRepository } from '../../config/config.repository';
import type { NotificationsRepository } from '../../notifications/notifications.repository';
import { ProductsRepository } from '../../products/products.repository';
import { TemplatesRepository } from '../../templates/templates.repository';
import { QuotesRepository } from '../quotes.repository';
import { QuotePdfGenerator, QuotesService } from '../quotes.service';

function serviceFor(tenantId: string) {
  const pdf = new QuotePdfGenerator(
    (fn) => testDb.transaction(fn),
    (tx) => ({
      quotes: new QuotesRepository(tx, tenantId),
      products: new ProductsRepository(tx, tenantId),
      templates: new TemplatesRepository(tx, tenantId),
    }),
    false,
  );
  return new QuotesService(
    new QuotesRepository(testDb, tenantId),
    new ConfigRepository(testDb, tenantId),
    { create: async () => undefined } as unknown as NotificationsRepository,
    pdf,
    () => undefined,
    false,
    true,
    true,
  );
}

describe('quote lines keep the tax rate they were quoted with', () => {
  let tenantId: string;
  let userId: string;
  let clientId: string;
  let barId: string;
  let exemptId: string;
  let quoteId: string;
  let service: QuotesService;

  const bar = (extra: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
    productId: barId,
    quantity: 2,
    subtotal: 2000,
    selections: [],
    ...extra,
  });
  const exempt = (extra: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
    productId: exemptId,
    quantity: 1,
    subtotal: 1000,
    selections: [],
    ...extra,
  });
  const input = (lines: QuoteLineInput[], extra: Record<string, unknown> = {}) => ({
    isDraft: false,
    selectOptionsAtQuote: false,
    clientId,
    lines,
    ...extra,
  });
  const storedLines = () =>
    testDb
      .select({
        productId: quoteLines.productId,
        taxRate: quoteLines.taxRate,
        taxAmount: quoteLines.taxAmount,
      })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId))
      .orderBy(asc(quoteLines.sortOrder));
  const storedQuote = async () =>
    (await testDb.select().from(quotes).where(eq(quotes.id, quoteId)))[0]!;
  const setProductRate = (id: string, taxRate: number) =>
    testDb.update(products).set({ taxRate }).where(eq(products.id, id));

  beforeEach(async () => {
    await resetDb();
    tenantId = (await createTestTenant('linetax')).id;
    userId = (await createTestUser()).id;
    await addMember(userId, tenantId);
    await testDb
      .insert(quoteStages)
      .values(
        Object.values(QUOTE_STAGE).map((id) => ({
          id,
          label: `stage ${id}`,
          color: '#000000',
          sortOrder: id,
        })),
      )
      .onConflictDoNothing();
    await testDb.insert(appSettings).values({ tenantId, defaultTaxRate: 0.05 });
    [{ id: clientId }] = (await testDb
      .insert(clients)
      .values({ tenantId, name: 'Client' })
      .returning({ id: clients.id })) as [{ id: string }];
    const uomId = await testUnitId(tenantId);
    [{ id: barId }, { id: exemptId }] = (await testDb
      .insert(products)
      .values([
        { tenantId, name: 'Bar', uomId, price: 1000, taxRate: 0.1 },
        { tenantId, name: 'Exempt', uomId, price: 1000, taxRate: 0.1, taxExempt: true },
      ])
      .returning({ id: products.id })) as [{ id: string }, { id: string }];

    service = serviceFor(tenantId);
    quoteId = (await service.create(input([bar(), exempt()]), userId, false)).id;
  });

  it('copies the rate of the product to a new line, 0 when it is exempt', async () => {
    expect(await storedLines()).toEqual([
      { productId: barId, taxRate: 0.1, taxAmount: 200 },
      { productId: exemptId, taxRate: 0, taxAmount: 0 },
    ]);
    const quote = await storedQuote();
    expect([quote.subtotal, quote.taxAmount, quote.total]).toEqual([3000, 200, 3200]);
  });

  it('exposes the rate and tax of each line and the breakdown by rate', async () => {
    const detail = await service.getById(quoteId);
    expect(detail.lines.map((l) => [l.taxRate, l.taxAmount])).toEqual([
      [0.1, 200],
      [0, 0],
    ]);
    expect(detail.taxBreakdown).toEqual([
      { taxRate: 0, taxAmount: 0 },
      { taxRate: 0.1, taxAmount: 200 },
    ]);
  });

  it('does not touch saved lines when the product rate changes', async () => {
    await setProductRate(barId, 0.2);
    expect((await storedLines())[0]).toMatchObject({ taxRate: 0.1, taxAmount: 200 });
    expect((await storedQuote()).total).toBe(3200);
  });

  it('keeps the rate and tax of a line resent unchanged', async () => {
    await setProductRate(barId, 0.2);
    await service.update(quoteId, input([bar(), exempt()], { notes: 'edited' }), false);
    expect(await storedLines()).toEqual([
      { productId: barId, taxRate: 0.1, taxAmount: 200 },
      { productId: exemptId, taxRate: 0, taxAmount: 0 },
    ]);
    const quote = await storedQuote();
    expect([quote.notes, quote.taxAmount, quote.total]).toEqual(['edited', 200, 3200]);
  });

  it('applies the current rate of the product to an edited line', async () => {
    await setProductRate(barId, 0.2);
    await service.update(quoteId, input([bar({ quantity: 3, subtotal: 3000 }), exempt()]), false);
    expect(await storedLines()).toEqual([
      { productId: barId, taxRate: 0.2, taxAmount: 600 },
      { productId: exemptId, taxRate: 0, taxAmount: 0 },
    ]);
    expect((await storedQuote()).total).toBe(4600);
  });

  it('applies the current rate to a new line next to a frozen one of the same product', async () => {
    await setProductRate(barId, 0.2);
    await service.update(quoteId, input([bar(), bar({ quantity: 1, subtotal: 1000 })]), false);
    expect(await storedLines()).toEqual([
      { productId: barId, taxRate: 0.1, taxAmount: 200 },
      { productId: barId, taxRate: 0.2, taxAmount: 200 },
    ]);
  });

  it('turns a line untaxed once its product becomes exempt and the line is edited', async () => {
    await testDb.update(products).set({ taxExempt: true }).where(eq(products.id, barId));
    await service.update(quoteId, input([bar({ quantity: 3, subtotal: 3000 })]), false);
    expect(await storedLines()).toEqual([{ productId: barId, taxRate: 0, taxAmount: 0 }]);
  });

  it('spreads the discount over the lines before taxing them', async () => {
    await service.update(
      quoteId,
      input([bar(), exempt()], { discountType: 'fixed', discountValue: 300 }),
      false,
    );
    // The taxed line carries 200 of the 300 discount: (2000 - 200) × 0.1.
    expect((await storedLines())[0]).toMatchObject({ taxAmount: 180 });
    const quote = await storedQuote();
    expect([quote.discountAmount, quote.taxAmount, quote.total]).toEqual([300, 180, 2880]);
  });

  it('ignores a tax rate smuggled into a line of the input', async () => {
    const parsed = createQuoteSchema.parse(input([{ ...bar(), taxRate: 0 } as QuoteLineInput]));
    const created = await service.create(
      { ...parsed, lines: parsed.lines.map((l) => ({ ...l, taxRate: 0 })) },
      userId,
      false,
    );
    const [line] = await testDb
      .select({ taxRate: quoteLines.taxRate, taxAmount: quoteLines.taxAmount })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, created.id));
    expect(line).toEqual({ taxRate: 0.1, taxAmount: 200 });
  });

  it('leaves products and saved lines alone when the organization default rate changes', async () => {
    await testDb
      .update(appSettings)
      .set({ defaultTaxRate: 0.3 })
      .where(eq(appSettings.tenantId, tenantId));
    const [product] = await testDb
      .select({ taxRate: products.taxRate })
      .from(products)
      .where(eq(products.id, barId));
    expect(product!.taxRate).toBe(0.1);
    await service.update(quoteId, input([bar(), exempt()], { notes: 'edited' }), false);
    expect(await storedLines()).toEqual([
      { productId: barId, taxRate: 0.1, taxAmount: 200 },
      { productId: exemptId, taxRate: 0, taxAmount: 0 },
    ]);
    await service.update(quoteId, input([bar({ quantity: 3, subtotal: 3000 }), exempt()]), false);
    expect((await storedLines())[0]).toEqual({ productId: barId, taxRate: 0.1, taxAmount: 300 });
  });

  it('reports stored tax that no line carries, as quotes saved before line taxes may hold', async () => {
    await testDb.delete(quoteLines).where(eq(quoteLines.quoteId, quoteId));
    await testDb.update(quotes).set({ taxAmount: 9 }).where(eq(quotes.id, quoteId));
    expect((await service.getById(quoteId)).taxBreakdown).toEqual([
      { taxRate: null, taxAmount: 9 },
    ]);
  });
});
