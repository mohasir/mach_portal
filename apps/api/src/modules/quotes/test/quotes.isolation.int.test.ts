import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  QUOTE_STAGE,
  quotesBoardQuerySchema,
  quotesListQuerySchema,
  type QuoteLineInput,
} from '@repo/schemas';
import {
  appSettings,
  clients,
  eventPayments,
  eventTypes,
  events,
  optionGroups,
  options,
  productPriceTiers,
  products,
  quoteAssignmentHistory,
  quoteLineOptions,
  quoteLines,
  quoteStageHistory,
  quoteStages,
  quotes,
} from '../../../db/schema';
import { createTestUser, resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { ConfigRepository } from '../../config/config.repository';
import type { NotificationsRepository } from '../../notifications/notifications.repository';
import { ProductsRepository } from '../../products/products.repository';
import { TemplatesRepository } from '../../templates/templates.repository';
import { QuotesRepository } from '../quotes.repository';
import { QuotesService } from '../quotes.service';

const DATE = '2030-06-01';
const TIME = '18:00';

type Seeded = {
  clientId: string;
  eventTypeId: string;
  productId: string;
  groupId: string;
  optionId: string;
  // PENDING quote with a line, a line option, stage and assignment history.
  quoteId: string;
  lineId: string;
  // CONFIRMED quote with an event and a payment.
  confirmedQuoteId: string;
  eventId: string;
};

async function seedTenant(tenant: TestTenant, label: string): Promise<Seeded> {
  await testDb.insert(appSettings).values({ tenantId: tenant.id });
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId: tenant.id, name: `Client ${label}` })
    .returning({ id: clients.id });
  const [eventType] = await testDb
    .insert(eventTypes)
    .values({ tenantId: tenant.id, name: `Wedding ${label}` })
    .returning({ id: eventTypes.id });
  const [product] = await testDb
    .insert(products)
    .values({ tenantId: tenant.id, name: `Menu ${label}` })
    .returning({ id: products.id });
  await testDb
    .insert(productPriceTiers)
    .values({ tenantId: tenant.id, productId: product!.id, numPersons: 10, price: 1000 });
  const [group] = await testDb
    .insert(optionGroups)
    .values({ tenantId: tenant.id, productId: product!.id, label: `Group ${label}` })
    .returning({ id: optionGroups.id });
  const [option] = await testDb
    .insert(options)
    .values({ tenantId: tenant.id, optionGroupId: group!.id, name: `Option ${label}` })
    .returning({ id: options.id });

  const base = {
    tenantId: tenant.id,
    clientId: client!.id,
    eventTypeId: eventType!.id,
    eventDate: DATE,
    eventTime: TIME,
    taxRate: 0.08,
    createdById: tenant.userId,
    assignedToId: tenant.userId,
  };
  // Both tenants share seq/number on purpose: numbering is per tenant.
  const [quote] = await testDb
    .insert(quotes)
    .values({ ...base, seq: 1, number: 'QUO-000001', stageId: QUOTE_STAGE.PENDING })
    .returning({ id: quotes.id });
  const [confirmed] = await testDb
    .insert(quotes)
    .values({ ...base, seq: 2, number: 'QUO-000002', stageId: QUOTE_STAGE.CONFIRMED })
    .returning({ id: quotes.id });

  const [line] = await testDb
    .insert(quoteLines)
    .values({
      tenantId: tenant.id,
      quoteId: quote!.id,
      productId: product!.id,
      numPersons: 10,
      subtotal: 1000,
    })
    .returning({ id: quoteLines.id });
  await testDb.insert(quoteLineOptions).values({
    tenantId: tenant.id,
    quoteLineId: line!.id,
    optionId: option!.id,
    optionGroupId: group!.id,
  });
  await testDb.insert(quoteStageHistory).values({
    tenantId: tenant.id,
    quoteId: quote!.id,
    toStageId: QUOTE_STAGE.PENDING,
    changedById: tenant.userId,
  });
  await testDb.insert(quoteAssignmentHistory).values({
    tenantId: tenant.id,
    quoteId: quote!.id,
    toUserId: tenant.userId,
    changedById: tenant.userId,
  });

  const [event] = await testDb
    .insert(events)
    .values({
      tenantId: tenant.id,
      quoteId: confirmed!.id,
      clientId: client!.id,
      totalAmount: 1000,
      depositPaid: true,
    })
    .returning({ id: events.id });
  await testDb.insert(eventPayments).values({
    tenantId: tenant.id,
    eventId: event!.id,
    method: 'cash',
    amount: 500,
    paidAt: '2030-01-01',
  });

  return {
    clientId: client!.id,
    eventTypeId: eventType!.id,
    productId: product!.id,
    groupId: group!.id,
    optionId: option!.id,
    quoteId: quote!.id,
    lineId: line!.id,
    confirmedQuoteId: confirmed!.id,
    eventId: event!.id,
  };
}

function lineFor(s: Seeded): QuoteLineInput {
  return {
    productId: s.productId,
    numPersons: 10,
    subtotal: 1000,
    selections: [{ optionGroupId: s.groupId, optionIds: [s.optionId] }],
  };
}

function quoteData(tenant: TestTenant, clientId?: string, eventTypeId?: string | null) {
  return { clientId, eventTypeId: eventTypeId ?? null, taxRate: 0.08, createdById: tenant.userId };
}

const numberFor = (seq: number) => `QUO-${String(seq).padStart(6, '0')}`;

async function quoteRow(id: string) {
  const [row] = await testDb.select().from(quotes).where(eq(quotes.id, id));
  return row!;
}

async function countRows(table: typeof quotes | typeof quoteLines | typeof clients) {
  return (await testDb.select({ id: table.id }).from(table)).length;
}

describe('quotes tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let sa: Seeded;
  let sb: Seeded;
  let repoA: QuotesRepository;
  let repoB: QuotesRepository;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    await testDb.insert(quoteStages).values(
      Object.values(QUOTE_STAGE).map((id) => ({
        id,
        label: `stage ${id}`,
        color: '#000000',
        sortOrder: id,
      })),
    );
    sa = await seedTenant(a, 'A');
    sb = await seedTenant(b, 'B');
    repoA = new QuotesRepository(testDb, a.id);
    repoB = new QuotesRepository(testDb, b.id);
  });

  describe('reads', () => {
    it('findPaginated lists and counts only the tenant quotes', async () => {
      const res = await repoA.findPaginated(
        quotesListQuerySchema.parse({ page: 1, pageSize: 10, search: 'QUO' }),
      );
      expect(res.items.map((q) => q.id).sort()).toEqual([sa.quoteId, sa.confirmedQuoteId].sort());
      expect(res.total).toBe(2);
      const pending = res.items.find((q) => q.id === sa.quoteId)!;
      expect(pending.clientName).toBe('Client A');
      expect(pending.eventTypeName).toBe('Wedding A');
      expect(pending.linesCount).toBe(1);
    });

    it('findPaginated filtered by another tenant client returns nothing', async () => {
      const res = await repoA.findPaginated(quotesListQuerySchema.parse({ clientId: sb.clientId }));
      expect(res.items).toEqual([]);
    });

    it('findBoard returns only the tenant quotes', async () => {
      const rows = await repoA.findBoard(quotesBoardQuerySchema.parse({ includeArchived: true }));
      expect(rows.map((r) => r.id).sort()).toEqual([sa.quoteId, sa.confirmedQuoteId].sort());
      expect(rows.find((r) => r.id === sa.confirmedQuoteId)?.eventId).toBe(sa.eventId);
    });

    it('findById does not return another tenant quote', async () => {
      expect(await repoA.findById(sb.quoteId)).toBeUndefined();
      expect(await repoA.findById(sb.quoteId, undefined, true)).toBeUndefined();
      const own = await repoA.findById(sa.quoteId);
      expect(own?.lineRows.map((l) => l.id)).toEqual([sa.lineId]);
      expect(own?.optionRows.map((o) => o.optionId)).toEqual([sa.optionId]);
      expect(own?.historyRows).toHaveLength(1);
      expect(own?.assignmentHistoryRows).toHaveLength(1);
    });

    it('findQuoteRow does not return another tenant quote', async () => {
      expect(await repoA.findQuoteRow(sb.quoteId)).toBeUndefined();
      expect((await repoA.findQuoteRow(sa.quoteId))?.id).toBe(sa.quoteId);
    });

    it('history reads of another tenant quote are empty', async () => {
      expect(await repoA.findStageHistory(sb.quoteId)).toEqual([]);
      expect(await repoA.findAssignmentHistory(sb.quoteId)).toEqual([]);
      expect(await repoB.findStageHistory(sb.quoteId)).toHaveLength(1);
    });

    it('line reads of another tenant quote are empty', async () => {
      expect(await repoA.countLines(sb.quoteId)).toBe(0);
      expect(await repoA.findLinesByQuoteId(sb.quoteId)).toEqual([]);
      expect(await repoB.countLines(sb.quoteId)).toBe(1);
    });

    it('hasEventPayments does not see another tenant payments', async () => {
      expect(await repoA.hasEventPayments(sb.confirmedQuoteId)).toBe(false);
      expect(await repoB.hasEventPayments(sb.confirmedQuoteId)).toBe(true);
    });

    it('availability checks only see the tenant bookings', async () => {
      const byTime = await repoA.findByDateTime(DATE, TIME);
      expect(byTime.map((r) => r.id).sort()).toEqual([sa.quoteId, sa.confirmedQuoteId].sort());
      const byDate = await repoA.findByDate(DATE, sa.quoteId);
      expect(byDate.map((r) => r.id)).toEqual([sa.confirmedQuoteId]);
    });

    it('loadCatalogContext ignores another tenant catalog', async () => {
      const ctx = await repoA.loadCatalogContext([sa.productId, sb.productId]);
      expect(ctx.products.map((p) => p.id)).toEqual([sa.productId]);
      expect(ctx.tiers.map((t) => t.productId)).toEqual([sa.productId]);
      expect(ctx.groups.map((g) => g.id)).toEqual([sa.groupId]);
      expect(ctx.options.map((o) => o.id)).toEqual([sa.optionId]);
    });
  });

  // Rows of tenant B that point at tenant A data. They cannot be produced through the API, but
  // they pin every filter on child tables individually.
  describe('stray rows of another tenant', () => {
    it('child rows of B attached to an A quote are ignored by every read', async () => {
      const [strayLine] = await testDb
        .insert(quoteLines)
        .values({
          tenantId: b.id,
          quoteId: sa.quoteId,
          productId: sb.productId,
          numPersons: 1,
          subtotal: 1,
        })
        .returning({ id: quoteLines.id });
      await testDb.insert(quoteLineOptions).values([
        {
          tenantId: b.id,
          quoteLineId: sa.lineId,
          optionId: sb.optionId,
          optionGroupId: sb.groupId,
        },
        {
          tenantId: b.id,
          quoteLineId: strayLine!.id,
          optionId: sb.optionId,
          optionGroupId: sb.groupId,
        },
      ]);
      await testDb.insert(quoteStageHistory).values({
        tenantId: b.id,
        quoteId: sa.quoteId,
        toStageId: QUOTE_STAGE.QUOTED,
      });
      await testDb.insert(quoteAssignmentHistory).values({
        tenantId: b.id,
        quoteId: sa.quoteId,
        toUserId: b.userId,
      });

      const own = await repoA.findById(sa.quoteId);
      expect(own?.lineRows.map((l) => l.id)).toEqual([sa.lineId]);
      expect(own?.optionRows.map((o) => o.optionId)).toEqual([sa.optionId]);
      expect(own?.historyRows).toHaveLength(1);
      expect(own?.assignmentHistoryRows).toHaveLength(1);
      expect(await repoA.countLines(sa.quoteId)).toBe(1);
      expect((await repoA.findLinesByQuoteId(sa.quoteId)).map((l) => l.id)).toEqual([sa.lineId]);
      const list = await repoA.findPaginated(quotesListQuerySchema.parse({}));
      expect(list.items.find((q) => q.id === sa.quoteId)?.linesCount).toBe(1);
      const board = await repoA.findBoard(quotesBoardQuerySchema.parse({}));
      expect(board.find((q) => q.id === sa.quoteId)?.linesCount).toBe(1);
    });

    it('an event and payment of B attached to an A quote are ignored', async () => {
      const [strayEvent] = await testDb
        .insert(events)
        .values({ tenantId: b.id, quoteId: sa.quoteId, clientId: sb.clientId, totalAmount: 1 })
        .returning({ id: events.id });
      await testDb.insert(eventPayments).values({
        tenantId: b.id,
        eventId: strayEvent!.id,
        method: 'cash',
        amount: 1,
        paidAt: '2030-01-01',
      });
      expect(await repoA.hasEventPayments(sa.quoteId)).toBe(false);
      expect((await repoA.findById(sa.quoteId))?.quoteRow.eventId).toBeNull();
      const list = await repoA.findPaginated(quotesListQuerySchema.parse({}));
      expect(list.items.find((q) => q.id === sa.quoteId)?.eventId).toBeNull();
      const board = await repoA.findBoard(quotesBoardQuerySchema.parse({}));
      expect(board.find((q) => q.id === sa.quoteId)?.eventId).toBeNull();
    });

    it('an A payment on an A event of a B quote is not reported for that quote', async () => {
      await testDb.delete(events).where(eq(events.id, sb.eventId));
      const [strayEvent] = await testDb
        .insert(events)
        .values({
          tenantId: a.id,
          quoteId: sb.confirmedQuoteId,
          clientId: sa.clientId,
          totalAmount: 1,
        })
        .returning({ id: events.id });
      await testDb.insert(eventPayments).values({
        tenantId: a.id,
        eventId: strayEvent!.id,
        method: 'cash',
        amount: 1,
        paidAt: '2030-01-01',
      });
      expect(await repoA.hasEventPayments(sb.confirmedQuoteId)).toBe(false);
    });

    it('an A payment on a B event of an A quote is not reported', async () => {
      const [strayEvent] = await testDb
        .insert(events)
        .values({ tenantId: b.id, quoteId: sa.quoteId, clientId: sb.clientId, totalAmount: 1 })
        .returning({ id: events.id });
      await testDb.insert(eventPayments).values({
        tenantId: a.id,
        eventId: strayEvent!.id,
        method: 'cash',
        amount: 1,
        paidAt: '2030-01-01',
      });
      expect(await repoA.hasEventPayments(sa.quoteId)).toBe(false);
    });

    it('a B payment on an A event of an A quote is not reported', async () => {
      const [ownEvent] = await testDb
        .insert(events)
        .values({ tenantId: a.id, quoteId: sa.quoteId, clientId: sa.clientId, totalAmount: 1 })
        .returning({ id: events.id });
      await testDb.insert(eventPayments).values({
        tenantId: b.id,
        eventId: ownEvent!.id,
        method: 'cash',
        amount: 1,
        paidAt: '2030-01-01',
      });
      expect(await repoA.hasEventPayments(sa.quoteId)).toBe(false);
    });

    it('a B quote pointing at an A client is not listed, boarded or booked for A', async () => {
      const [strayQuote] = await testDb
        .insert(quotes)
        .values({
          tenantId: b.id,
          seq: 99,
          number: 'QUO-000099',
          clientId: sa.clientId,
          eventDate: DATE,
          eventTime: TIME,
          taxRate: 0.08,
        })
        .returning({ id: quotes.id });
      const list = await repoA.findPaginated(
        quotesListQuerySchema.parse({ page: 1, pageSize: 10 }),
      );
      expect(list.items.map((q) => q.id)).not.toContain(strayQuote!.id);
      expect(list.total).toBe(2);
      const board = await repoA.findBoard(quotesBoardQuerySchema.parse({}));
      expect(board.map((q) => q.id)).not.toContain(strayQuote!.id);
      const bookings = await repoA.findByDateTime(DATE, TIME);
      expect(bookings.map((r) => r.id)).not.toContain(strayQuote!.id);
    });

    it('an A quote referencing a B event type or client never shows B names', async () => {
      await testDb
        .update(quotes)
        .set({ eventTypeId: sb.eventTypeId })
        .where(eq(quotes.id, sa.quoteId));
      await testDb
        .update(quotes)
        .set({ clientId: sb.clientId })
        .where(eq(quotes.id, sa.confirmedQuoteId));

      const pending = await repoA.findById(sa.quoteId);
      expect(pending?.quoteRow.eventTypeName).toBeNull();
      const list = await repoA.findPaginated(quotesListQuerySchema.parse({}));
      expect(list.items.map((q) => q.clientName)).not.toContain('Client B');
      expect(list.items.find((q) => q.id === sa.quoteId)?.eventTypeName).toBeNull();
      const board = await repoA.findBoard(quotesBoardQuerySchema.parse({}));
      expect(board.map((q) => q.clientName)).not.toContain('Client B');
      expect(board.find((q) => q.id === sa.quoteId)?.eventTypeName).toBeNull();
      const bookings = await repoA.findByDateTime(DATE, TIME);
      expect(bookings.map((r) => r.clientName)).not.toContain('Client B');
      expect(bookings.find((r) => r.id === sa.quoteId)?.eventTypeName).toBeNull();
    });

    it('catalog rows of B attached to an A product are ignored', async () => {
      await testDb
        .insert(productPriceTiers)
        .values({ tenantId: b.id, productId: sa.productId, numPersons: 99, price: 1 });
      const [strayGroup] = await testDb
        .insert(optionGroups)
        .values({ tenantId: b.id, productId: sa.productId, label: 'stray' })
        .returning({ id: optionGroups.id });
      await testDb
        .insert(options)
        .values({ tenantId: b.id, optionGroupId: sa.groupId, name: 'stray option' });
      await testDb
        .insert(options)
        .values({ tenantId: a.id, optionGroupId: strayGroup!.id, name: 'orphan' });

      const ctx = await repoA.loadCatalogContext([sa.productId]);
      expect(ctx.tiers.map((t) => t.numPersons)).toEqual([10]);
      expect(ctx.groups.map((g) => g.id)).toEqual([sa.groupId]);
      expect(ctx.options.map((o) => o.id)).toEqual([sa.optionId]);
    });
  });

  describe('mutations', () => {
    it('setPdfInfo cannot touch another tenant quote', async () => {
      expect(await repoA.setPdfInfo(sb.quoteId, { url: 'u', key: 'k' })).toBeUndefined();
      expect((await quoteRow(sb.quoteId)).pdfKey).toBeNull();
      expect((await repoA.setPdfInfo(sa.quoteId, { url: 'u', key: 'k' }))?.pdfUrl).toBe('u');
    });

    it('updateRates cannot touch another tenant quote', async () => {
      const expected = { taxRate: 0.08, cardSurchargeRate: 0.09 };
      expect(await repoA.updateRates(sb.quoteId, expected, { declinedRates: null, total: 1 })).toBe(
        undefined,
      );
      expect((await quoteRow(sb.quoteId)).total).toBe(0);
      expect((await repoA.updateRates(sa.quoteId, expected, { total: 7 }))?.total).toBe(7);
    });

    it('archiveById cannot archive another tenant quote', async () => {
      expect(await repoA.archiveById(sb.quoteId, a.userId)).toBeUndefined();
      expect((await quoteRow(sb.quoteId)).archivedAt).toBeNull();
      expect(await repoA.archiveById(sa.quoteId, a.userId)).toEqual({ id: sa.quoteId });
    });

    it('updateStage cannot touch another tenant quote nor write its history', async () => {
      const res = await repoA.updateStage(
        sb.quoteId,
        QUOTE_STAGE.PENDING,
        QUOTE_STAGE.QUOTED,
        a.userId,
      );
      expect(res).toBeUndefined();
      expect((await quoteRow(sb.quoteId)).stageId).toBe(QUOTE_STAGE.PENDING);
      expect(await repoB.findStageHistory(sb.quoteId)).toHaveLength(1);

      await repoA.updateStage(sa.quoteId, QUOTE_STAGE.PENDING, QUOTE_STAGE.QUOTED, a.userId);
      const history = await testDb
        .select()
        .from(quoteStageHistory)
        .where(eq(quoteStageHistory.quoteId, sa.quoteId));
      expect(history).toHaveLength(2);
      expect(history.every((h) => h.tenantId === a.id)).toBe(true);
    });

    it('approveWithEvent cannot touch another tenant quote nor create its event', async () => {
      const eventData = { clientId: sb.clientId, totalAmount: 1 };
      const res = await repoA.approveWithEvent(
        sb.quoteId,
        QUOTE_STAGE.PENDING,
        a.userId,
        eventData,
      );
      expect(res).toBeUndefined();
      expect((await quoteRow(sb.quoteId)).stageId).toBe(QUOTE_STAGE.PENDING);
      expect(await testDb.select().from(events).where(eq(events.quoteId, sb.quoteId))).toEqual([]);

      await repoA.approveWithEvent(sa.quoteId, QUOTE_STAGE.PENDING, a.userId, {
        clientId: sa.clientId,
        totalAmount: 1,
      });
      const [event] = await testDb.select().from(events).where(eq(events.quoteId, sa.quoteId));
      expect(event?.tenantId).toBe(a.id);
      const history = await testDb
        .select()
        .from(quoteStageHistory)
        .where(eq(quoteStageHistory.quoteId, sa.quoteId));
      expect(history.every((h) => h.tenantId === a.id)).toBe(true);
    });

    it('assignById cannot touch another tenant quote', async () => {
      expect(await repoA.assignById(sb.quoteId, a.userId, a.userId)).toBeUndefined();
      expect((await quoteRow(sb.quoteId)).assignedToId).toBe(b.userId);
      expect(await repoB.findAssignmentHistory(sb.quoteId)).toHaveLength(1);
    });

    it('assignById rejects a user that is not a member of the tenant', async () => {
      const outsider = await createTestUser();
      expect(await repoA.assignById(sa.quoteId, b.userId, a.userId)).toEqual({
        missingRef: 'user',
      });
      expect(await repoA.assignById(sa.quoteId, outsider.id, a.userId)).toEqual({
        missingRef: 'user',
      });
      expect((await quoteRow(sa.quoteId)).assignedToId).toBe(a.userId);
      expect(await repoA.findAssignmentHistory(sa.quoteId)).toHaveLength(1);
    });

    it('assignById to a member (or nobody) writes history stamped with the tenant', async () => {
      const updated = await repoA.assignById(sa.quoteId, null, a.userId);
      expect(updated && 'id' in updated ? updated.assignedToId : 'x').toBeNull();
      await repoA.assignById(sa.quoteId, a.userId, a.userId);
      const history = await testDb
        .select()
        .from(quoteAssignmentHistory)
        .where(eq(quoteAssignmentHistory.quoteId, sa.quoteId));
      expect(history).toHaveLength(3);
      expect(history.every((h) => h.tenantId === a.id)).toBe(true);
    });

    it('insertFull stamps the tenant on the quote and every child row', async () => {
      const created = await repoA.insertFull(quoteData(a, sa.clientId, sa.eventTypeId), numberFor, [
        lineFor(sa),
      ]);
      if (!('id' in created)) throw new Error('expected a quote');
      expect((await quoteRow(created.id)).tenantId).toBe(a.id);
      const lines = await testDb
        .select()
        .from(quoteLines)
        .where(eq(quoteLines.quoteId, created.id));
      expect(lines.map((l) => l.tenantId)).toEqual([a.id]);
      const opts = await testDb
        .select()
        .from(quoteLineOptions)
        .where(eq(quoteLineOptions.quoteLineId, lines[0]!.id));
      expect(opts.map((o) => o.tenantId)).toEqual([a.id]);
      const history = await testDb
        .select()
        .from(quoteStageHistory)
        .where(eq(quoteStageHistory.quoteId, created.id));
      expect(history.map((h) => h.tenantId)).toEqual([a.id]);
    });

    it('insertFull creates an inline new client inside the tenant', async () => {
      const created = await repoA.insertFull(quoteData(a), numberFor, [], { name: 'Inline' });
      if (!('id' in created)) throw new Error('expected a quote');
      const [client] = await testDb.select().from(clients).where(eq(clients.id, created.clientId));
      expect(client?.tenantId).toBe(a.id);
    });

    it('insertFull rejects another tenant client or event type and inserts nothing', async () => {
      const before = [await countRows(quotes), await countRows(quoteLines)];
      expect(await repoA.insertFull(quoteData(a, sb.clientId), numberFor, [lineFor(sa)])).toEqual({
        missingRef: 'client',
      });
      expect(
        await repoA.insertFull(quoteData(a, sa.clientId, sb.eventTypeId), numberFor, [lineFor(sa)]),
      ).toEqual({ missingRef: 'eventType' });
      expect([await countRows(quotes), await countRows(quoteLines)]).toEqual(before);
    });

    it('insertFull with an inline new client and a foreign event type inserts no client', async () => {
      const before = [await countRows(quotes), await countRows(clients)];
      expect(
        await repoA.insertFull(quoteData(a, undefined, sb.eventTypeId), numberFor, [], {
          name: 'Inline',
        }),
      ).toEqual({ missingRef: 'eventType' });
      expect([await countRows(quotes), await countRows(clients)]).toEqual(before);
    });

    it('replaceLines cannot touch another tenant quote nor its lines', async () => {
      const res = await repoA.replaceLines(
        sb.quoteId,
        { ...quoteData(a, sb.clientId), taxRate: 0.5 },
        [lineFor(sa), lineFor(sa)],
      );
      expect(res).toBeUndefined();
      const lines = await testDb
        .select({ tenantId: quoteLines.tenantId })
        .from(quoteLines)
        .where(eq(quoteLines.quoteId, sb.quoteId));
      expect(lines.map((l) => l.tenantId)).toEqual([b.id]);
      expect((await quoteRow(sb.quoteId)).taxRate).toBe(0.08);
    });

    it('replaceLines rejects another tenant client or event type and changes nothing', async () => {
      expect(
        await repoA.replaceLines(sa.quoteId, quoteData(a, sb.clientId), [lineFor(sa)]),
      ).toEqual({ missingRef: 'client' });
      expect(
        await repoA.replaceLines(sa.quoteId, quoteData(a, sa.clientId, sb.eventTypeId), []),
      ).toEqual({ missingRef: 'eventType' });
      const row = await quoteRow(sa.quoteId);
      expect(row.clientId).toBe(sa.clientId);
      expect(row.eventTypeId).toBe(sa.eventTypeId);
      expect(await repoA.countLines(sa.quoteId)).toBe(1);
    });

    it('replaceLines on an own quote leaves another tenant lines untouched', async () => {
      // A stray B line on the A quote must survive the A-side replace.
      await testDb.insert(quoteLines).values({
        tenantId: b.id,
        quoteId: sa.quoteId,
        productId: sb.productId,
        numPersons: 1,
        subtotal: 1,
      });
      const res = await repoA.replaceLines(sa.quoteId, quoteData(a, sa.clientId), [
        lineFor(sa),
        lineFor(sa),
      ]);
      expect(res && 'id' in res).toBe(true);
      const lines = await testDb
        .select()
        .from(quoteLines)
        .where(eq(quoteLines.quoteId, sa.quoteId));
      expect(lines.filter((l) => l.tenantId === a.id)).toHaveLength(2);
      expect(lines.filter((l) => l.tenantId === b.id)).toHaveLength(1);
      expect(await repoB.countLines(sb.quoteId)).toBe(1);
    });
  });

  describe('service boundary', () => {
    function serviceFor(tenant: TestTenant) {
      return new QuotesService(
        new QuotesRepository(testDb, tenant.id),
        new ConfigRepository(testDb, tenant.id),
        new ProductsRepository(testDb, tenant.id),
        new TemplatesRepository(testDb, tenant.id),
        {} as NotificationsRepository,
      );
    }
    const draft = { isDraft: true, selectOptionsAtQuote: false };

    it('create with another tenant product or option is rejected and inserts nothing', async () => {
      const before = await countRows(quotes);
      const service = serviceFor(a);
      await expect(
        service.create({ ...draft, clientId: sa.clientId, lines: [lineFor(sb)] }, a.userId, true),
      ).rejects.toMatchObject({ cause: { code: 'QUOTE_INVALID_LINES' } });
      const mixed = {
        ...lineFor(sa),
        selections: [{ optionGroupId: sa.groupId, optionIds: [sb.optionId] }],
      };
      await expect(
        service.create({ ...draft, clientId: sa.clientId, lines: [mixed] }, a.userId, true),
      ).rejects.toMatchObject({ cause: { code: 'QUOTE_INVALID_LINES' } });
      expect(await countRows(quotes)).toBe(before);
    });

    it('create and update with another tenant client or event type are NOT_FOUND', async () => {
      const service = serviceFor(a);
      await expect(
        service.create({ ...draft, clientId: sb.clientId, lines: [] }, a.userId, true),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'CLIENT_NOT_FOUND' } });
      await expect(
        service.update(
          sa.quoteId,
          { ...draft, clientId: sa.clientId, eventTypeId: sb.eventTypeId, lines: [] },
          true,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'EVENT_TYPE_NOT_FOUND' } });
    });

    it('assign to a non-member is NOT_FOUND', async () => {
      await expect(serviceFor(a).assign(sa.quoteId, b.userId, a.userId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        cause: { code: 'USER_NOT_FOUND' },
      });
    });

    it('create numbers the quote inside the tenant sequence', async () => {
      const created = await serviceFor(b).create(
        { ...draft, clientId: sb.clientId, lines: [lineFor(sb)] },
        b.userId,
        true,
      );
      expect(created.seq).toBe(3);
      expect(created.number).toMatch(/^QUO\d{8}-000003$/);
    });
  });
});
