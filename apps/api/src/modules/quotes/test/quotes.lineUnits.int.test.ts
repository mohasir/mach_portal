import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { QUOTE_STAGE, type QuoteLineInput } from '@repo/schemas';
import {
  appSettings,
  clients,
  events,
  optionGroups,
  options,
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
import { EventsRepository } from '../../events/events.repository';
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
  );
}

const invalidUnit = { code: 'BAD_REQUEST', cause: { code: 'QUOTE_INVALID_LINE_UNIT' } };

describe('quote lines keep the unit they were quoted in', () => {
  let tenantId: string;
  let otherTenantId: string;
  let userId: string;
  let clientId: string;
  let productId: string;
  let quoteId: string;
  let persId: string;
  let hourId: string;
  let galId: string;
  let service: QuotesService;

  const line = (extra: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
    productId,
    quantity: 2,
    subtotal: 2000,
    selections: [],
    ...extra,
  });
  const input = (lines: QuoteLineInput[], notes = 'edited') => ({
    isDraft: false,
    selectOptionsAtQuote: false,
    clientId,
    notes,
    lines,
  });
  const save = (lines: QuoteLineInput[], notes?: string) =>
    service.update(quoteId, input(lines, notes), false);
  const unitsOfQuote = async () =>
    (await service.getById(quoteId)).lines.map((l) => [l.uomId, l.unit.code]);
  const changeProductUnit = (uomId: string) =>
    testDb.update(products).set({ uomId }).where(eq(products.id, productId));

  beforeEach(async () => {
    await resetDb();
    tenantId = (await createTestTenant('lineunits')).id;
    otherTenantId = (await createTestTenant('lineunits-other')).id;
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
    persId = await testUnitId(tenantId, 'pers');
    hourId = await testUnitId(tenantId, 'h');
    galId = await testUnitId(tenantId, 'gal');
    [{ id: productId }] = (await testDb
      .insert(products)
      .values({ tenantId, name: 'Bar', uomId: persId, price: 1000 })
      .returning({ id: products.id })) as [{ id: string }];

    service = serviceFor(tenantId);
    const created = await service.create(input([line()], 'first'), userId, false);
    quoteId = created.id;
  });

  it('stores the current unit of the product on a new line', async () => {
    expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
  });

  it('does not change the unit of saved lines when the product changes unit', async () => {
    await changeProductUnit(hourId);
    expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
    expect((await service.getById(quoteId)).lines[0]!.unit).toMatchObject({
      id: persId,
      code: 'pers',
      dimension: 'quantity',
    });
  });

  it('keeps the unit of an existing line when the edit sends it back', async () => {
    await changeProductUnit(hourId);
    await save([line({ uomId: persId })]);
    expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
  });

  it('gives a line sent without uomId the current unit of the product', async () => {
    await changeProductUnit(hourId);
    await save([line()]);
    expect(await unitsOfQuote()).toEqual([[hourId, 'h']]);
  });

  it('mixes frozen and new lines of the same product in one edit', async () => {
    await changeProductUnit(hourId);
    await save([line({ uomId: persId }), line()]);
    const units = await unitsOfQuote();
    expect(units).toHaveLength(2);
    expect(units).toEqual(
      expect.arrayContaining([
        [persId, 'pers'],
        [hourId, 'h'],
      ]),
    );
  });

  describe('after the product moved to another unit with a higher minimum', () => {
    beforeEach(async () => {
      await testDb
        .update(products)
        .set({ uomId: hourId, minQuantity: 20 })
        .where(eq(products.id, productId));
    });

    it('validates a line resent without uomId against the product as it is now', async () => {
      await expect(save([line()])).rejects.toMatchObject({
        cause: { code: 'QUOTE_BELOW_MIN_QUANTITY' },
      });
      expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
    });

    it('lets a line resending its stored unit through untouched', async () => {
      await save([line({ uomId: persId })]);
      expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
    });

    describe('a line that keeps its old unit', () => {
      const stillStored = async () => {
        expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
        const [row] = await testDb.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId));
        expect([row!.quantity, row!.subtotal]).toEqual([2, 2000]);
        const [quote] = await testDb.select().from(quotes).where(eq(quotes.id, quoteId));
        expect(quote!.notes).toBe('first');
      };

      it('cannot change its quantity without line pricing, writing nothing', async () => {
        await expect(
          save([line({ uomId: persId, quantity: 3, subtotal: 3000 })], 'second'),
        ).rejects.toMatchObject(invalidUnit);
        await stillStored();
      });

      it('cannot be underpriced by a hand-crafted payload, writing nothing', async () => {
        // 5 x 100 matches the product's price in its new unit, but the line is still in the old one.
        await testDb.update(products).set({ price: 100 }).where(eq(products.id, productId));
        await expect(
          save([line({ uomId: persId, quantity: 5, subtotal: 500 })], 'second'),
        ).rejects.toMatchObject(invalidUnit);
        await stillStored();
      });

      it('may change only its options and keeps its unit', async () => {
        const [group] = await testDb
          .insert(optionGroups)
          .values({ tenantId, productId, label: 'Group' })
          .returning({ id: optionGroups.id });
        const [option] = await testDb
          .insert(options)
          .values({ tenantId, optionGroupId: group!.id, name: 'Option' })
          .returning({ id: options.id });
        await save([
          line({
            uomId: persId,
            selections: [{ optionGroupId: group!.id, optionIds: [option!.id] }],
          }),
        ]);
        expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
        const detail = await service.getById(quoteId);
        expect(detail.lines[0]!.selections).toEqual([
          { optionGroupId: group!.id, optionIds: [option!.id] },
        ]);
      });

      it('may be repriced by a user with line pricing', async () => {
        await service.update(quoteId, input([line({ uomId: persId, subtotal: 1500 })]), true);
        const detail = await service.getById(quoteId);
        expect(detail.lines.map((l) => [l.unit.code, l.subtotal])).toEqual([['pers', 1500]]);
      });
    });
  });

  it('accepts the current unit of the product explicitly', async () => {
    await save([line({ uomId: persId })]);
    expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
  });

  it('reads the unit of the line, not the product, in the event detail', async () => {
    await changeProductUnit(hourId);
    await testDb.update(quotes).set({ stageId: QUOTE_STAGE.QUOTED }).where(eq(quotes.id, quoteId));
    await service.approve(quoteId, userId, { id: userId, name: 'U' } as never);
    const [event] = await testDb.select().from(events).where(eq(events.quoteId, quoteId));
    const found = await new EventsRepository(testDb, tenantId).findById(event!.id);
    expect(found?.lineRows.map((l) => [l.uomId, l.unit.code])).toEqual([[persId, 'pers']]);
  });

  describe('rejects a unit that no line of the quote backs, writing nothing', () => {
    const untouched = async () => {
      const [quote] = await testDb.select().from(quotes).where(eq(quotes.id, quoteId));
      expect(quote!.notes).toBe('first');
      expect(await unitsOfQuote()).toEqual([[persId, 'pers']]);
    };

    it('a unit of the same tenant with no previous line', async () => {
      await expect(save([line({ uomId: galId })])).rejects.toMatchObject(invalidUnit);
      await untouched();
    });

    it('a unit of another tenant', async () => {
      const foreign = await testUnitId(otherTenantId, 'h');
      await expect(save([line({ uomId: foreign })])).rejects.toMatchObject(invalidUnit);
      await untouched();
    });

    it('a unit that does not exist', async () => {
      const missing = '00000000-0000-4000-8000-000000000000';
      await expect(save([line({ uomId: missing })])).rejects.toMatchObject(invalidUnit);
      await untouched();
    });

    it('a unit backed only by a line of a different product', async () => {
      const [other] = await testDb
        .insert(products)
        .values({ tenantId, name: 'Hour product', uomId: hourId, price: 1000 })
        .returning({ id: products.id });
      await save([line(), line({ productId: other!.id })], 'first');
      const before = await unitsOfQuote();
      await expect(save([line({ uomId: hourId })], 'second')).rejects.toMatchObject(invalidUnit);
      const [quote] = await testDb.select().from(quotes).where(eq(quotes.id, quoteId));
      expect(quote!.notes).toBe('first');
      expect(await unitsOfQuote()).toEqual(before);
      expect(before).toHaveLength(2);
    });

    it('a different unit on a new quote, which has no line to back it', async () => {
      const before = await testDb.select().from(quotes);
      await expect(
        service.create(input([line({ uomId: hourId })], 'new'), userId, false),
      ).rejects.toMatchObject(invalidUnit);
      expect(await testDb.select().from(quotes)).toHaveLength(before.length);
    });
  });

  it('does not let another organization read or edit the quote with its own units', async () => {
    const other = serviceFor(otherTenantId);
    const foreign = await testUnitId(otherTenantId, 'pers');
    await expect(other.getById(quoteId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      other.update(quoteId, input([line({ uomId: foreign })]), false),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const rows = await testDb.select().from(quoteLines).where(eq(quoteLines.quoteId, quoteId));
    expect(rows.map((r) => r.uomId)).toEqual([persId]);
  });
});
