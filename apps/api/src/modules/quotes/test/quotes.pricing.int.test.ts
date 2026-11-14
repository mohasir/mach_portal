import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { QUOTE_STAGE, type QuoteLineInput } from '@repo/schemas';
import {
  appSettings,
  clients,
  events,
  productPriceTiers,
  products,
  quoteLines,
  quoteStages,
  quotes,
} from '../../../db/schema';
import { createTestUser, createTestTenant, addMember, resetDb, testDb } from '../../../test/db';
import { ConfigRepository } from '../../config/config.repository';
import type { NotificationsRepository } from '../../notifications/notifications.repository';
import { ProductsRepository } from '../../products/products.repository';
import { TemplatesRepository } from '../../templates/templates.repository';
import { QuotesRepository } from '../quotes.repository';
import { QuotePdfGenerator, QuotesService } from '../quotes.service';

function serviceFor(tenantId: string, priceTiersActive: boolean, eventsActive = true) {
  const pdf = new QuotePdfGenerator(
    (fn) => testDb.transaction(fn),
    (tx) => ({
      quotes: new QuotesRepository(tx, tenantId),
      products: new ProductsRepository(tx, tenantId),
      templates: new TemplatesRepository(tx, tenantId),
    }),
    priceTiersActive,
  );
  const notifications = { create: async () => undefined } as unknown as NotificationsRepository;
  return new QuotesService(
    new QuotesRepository(testDb, tenantId),
    new ConfigRepository(testDb, tenantId),
    notifications,
    pdf,
    () => undefined,
    priceTiersActive,
    eventsActive,
  );
}

describe('quote prices are frozen once a line is saved', () => {
  let tenantId: string;
  let userId: string;
  let clientId: string;
  let productId: string;
  let quoteId: string;

  beforeEach(async () => {
    await resetDb();
    tenantId = (await createTestTenant('pricing')).id;
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
    await testDb.insert(appSettings).values({ tenantId });
    [{ id: clientId }] = (await testDb
      .insert(clients)
      .values({ tenantId, name: 'Client' })
      .returning({ id: clients.id })) as [{ id: string }];
    [{ id: productId }] = (await testDb
      .insert(products)
      .values({ tenantId, name: 'Bar' })
      .returning({ id: products.id })) as [{ id: string }];
    await testDb
      .insert(productPriceTiers)
      .values({ tenantId, productId, numPersons: 40, price: 150000 });

    const created = await serviceFor(tenantId, true).create(
      {
        isDraft: false,
        selectOptionsAtQuote: false,
        clientId,
        lines: [{ productId, numPersons: 40, subtotal: 150000, selections: [] }],
      },
      userId,
      false,
    );
    if (!('id' in created)) throw new Error('expected a quote');
    quoteId = created.id;
    await testDb.update(quotes).set({ stageId: QUOTE_STAGE.QUOTED }).where(eq(quotes.id, quoteId));
  });

  async function loseTiersAndPrice() {
    await testDb.delete(productPriceTiers).where(eq(productPriceTiers.productId, productId));
    await testDb.update(products).set({ price: null }).where(eq(products.id, productId));
  }

  it('reads and approves the quote after the add-on is off and the product lost its tiers', async () => {
    await loseTiersAndPrice();
    const service = serviceFor(tenantId, false);

    const detail = await service.getById(quoteId);
    expect(detail.lines.map((l) => l.subtotal)).toEqual([150000]);

    const approved = await service.approve(quoteId, userId, { id: userId, name: 'U' } as never);
    expect(approved.stageId).toBe(QUOTE_STAGE.CONFIRMED);

    const [line] = await testDb.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId));
    expect(line!.subtotal).toBe(150000);
  });

  it('approving creates the derived event only when the events module is active', async () => {
    const approved = await serviceFor(tenantId, true, false).approve(quoteId, userId, {
      id: userId,
      name: 'U',
    } as never);
    expect(approved.stageId).toBe(QUOTE_STAGE.CONFIRMED);
    expect(await testDb.select().from(events).where(eq(events.quoteId, quoteId))).toEqual([]);
  });

  it('approving with the events module active creates the event', async () => {
    await serviceFor(tenantId, true, true).approve(quoteId, userId, {
      id: userId,
      name: 'U',
    } as never);
    const rows = await testDb.select().from(events).where(eq(events.quoteId, quoteId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tenantId).toBe(tenantId);
  });

  const save = (service: QuotesService, lines: QuoteLineInput[], notes = 'edited') =>
    service.update(
      quoteId,
      { isDraft: false, selectOptionsAtQuote: false, clientId, notes, lines },
      false,
    );
  const tierLine: QuoteLineInput = {
    productId: '',
    numPersons: 40,
    subtotal: 150000,
    selections: [],
  };

  it('re-saves an unchanged line after the add-on is off and the product lost tiers and price', async () => {
    await loseTiersAndPrice();
    const updated = await save(serviceFor(tenantId, false), [{ ...tierLine, productId }]);
    expect(updated).toMatchObject({ notes: 'edited' });
    const lines = await testDb.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId));
    expect(lines.map((l) => l.subtotal)).toEqual([150000]);
  });

  it('validates a modified line as before', async () => {
    await loseTiersAndPrice();
    const service = serviceFor(tenantId, false);
    for (const change of [{ numPersons: 50 }, { subtotal: 140000 }]) {
      await expect(save(service, [{ ...tierLine, productId, ...change }])).rejects.toMatchObject({
        cause: { code: 'PRODUCT_NOT_QUOTABLE' },
      });
    }
  });

  it('rejects a new line for a product that is not quotable', async () => {
    const [other] = await testDb
      .insert(products)
      .values({ tenantId, name: 'No price' })
      .returning({ id: products.id });
    await expect(
      save(serviceFor(tenantId, true), [
        { ...tierLine, productId },
        { ...tierLine, productId: other!.id },
      ]),
    ).rejects.toMatchObject({ cause: { code: 'PRODUCT_NOT_QUOTABLE' } });
  });

  it('validates the extra copy of a line stored only once', async () => {
    await loseTiersAndPrice();
    const line = { ...tierLine, productId };
    await expect(save(serviceFor(tenantId, false), [line, line])).rejects.toMatchObject({
      cause: { code: 'PRODUCT_NOT_QUOTABLE' },
    });
  });
});
