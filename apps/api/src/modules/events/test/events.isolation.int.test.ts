import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { eventsListQuerySchema } from '@repo/schemas';
import {
  eventHistory,
  eventPaymentAttachments,
  eventPayments,
  eventReschedules,
  eventStaff,
  events,
  notifications,
  optionGroups,
  quoteLineOptions,
  quoteLines,
  quotes,
} from '../../../db/schema';
import type { StorageProvider } from '../../../lib/storage';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { ConfigRepository } from '../../config/config.repository';
import { NotificationsRepository } from '../../notifications/notifications.repository';
import { QuotesRepository } from '../../quotes/quotes.repository';
import { RescheduleReasonsRepository } from '../../rescheduleReasons/rescheduleReasons.repository';
import { StaffRepository } from '../../staff/staff.repository';
import { EventsRepository } from '../events.repository';
import { EventsService } from '../events.service';
import {
  DATE,
  insertPayment,
  insertStrayEvent,
  seedEventsTenant,
  seedQuoteStages,
  type EventsSeed,
} from '../../../test/fixtures/events';

const allEvents = () => eventsListQuerySchema.parse({ segment: 'all' });

const tenantRows = async (
  table:
    | typeof eventPayments
    | typeof eventStaff
    | typeof eventReschedules
    | typeof eventPaymentAttachments
    | typeof notifications
    | typeof quoteLineOptions,
  tenantId: string,
) => testDb.select().from(table).where(eq(table.tenantId, tenantId));

const historyOf = (tenantId: string) =>
  testDb.select().from(eventHistory).where(eq(eventHistory.tenantId, tenantId));

function fakeStorage() {
  return {
    upload: vi.fn(async ({ key }: { key: string }) => ({ url: `http://r2/${key}` })),
    delete: vi.fn(async () => undefined),
  };
}

function serviceFor(tenant: TestTenant, storage = fakeStorage()) {
  const id = tenant.id;
  return new EventsService(
    new EventsRepository(testDb, id),
    new QuotesRepository(testDb, id),
    new ConfigRepository(testDb, id),
    new RescheduleReasonsRepository(testDb, id),
    new NotificationsRepository(testDb, id),
    new StaffRepository(testDb, id),
    storage as unknown as StorageProvider,
  );
}

describe('events tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let sa: EventsSeed;
  let sb: EventsSeed;
  let repoA: EventsRepository;
  let repoB: EventsRepository;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    await seedQuoteStages();
    sa = await seedEventsTenant(a, 'A');
    sb = await seedEventsTenant(b, 'B');
    repoA = new EventsRepository(testDb, a.id);
    repoB = new EventsRepository(testDb, b.id);
  });

  describe('reads', () => {
    it('findPaginated lists and counts only the tenant events', async () => {
      const res = await repoA.findPaginated(
        eventsListQuerySchema.parse({ segment: 'all', page: 1, pageSize: 10 }),
      );
      expect(res.items.map((e) => e.id).sort()).toEqual([sa.eventId, sa.event2Id].sort());
      expect(res.total).toBe(2);
      const own = res.items.find((e) => e.id === sa.eventId)!;
      expect(own.clientName).toBe('Client A');
      expect(own.eventTypeName).toBe('Wedding A');
      expect(Number(own.totalPaid)).toBe(300);
      expect(own.staff.map((s) => s.staffId)).toEqual([sa.staffId]);
      const resB = await repoB.findPaginated(allEvents());
      expect(resB.items.map((e) => e.id).sort()).toEqual([sb.eventId, sb.event2Id].sort());
    });

    it('findPaginated filtered by another tenant client returns nothing', async () => {
      const res = await repoA.findPaginated(
        eventsListQuerySchema.parse({ segment: 'all', clientId: sb.clientId }),
      );
      expect(res.items).toEqual([]);
    });

    it('findCalendarRange returns only the tenant events', async () => {
      const rows = await repoA.findCalendarRange({ month: 6, year: 2030 });
      expect(rows.map((e) => e.id).sort()).toEqual([sa.eventId, sa.event2Id].sort());
    });

    it('findById does not return another tenant event and loads only own children', async () => {
      expect(await repoA.findById(sb.eventId)).toBeUndefined();
      const own = await repoA.findById(sa.eventId);
      expect(own?.lineRows.map((l) => l.id)).toEqual([sa.lineId]);
      expect(own?.optionRows).toEqual([]);
      expect(own?.selectionsIncomplete).toBe(true);
      expect(own?.staffRows.map((s) => s.staffId)).toEqual([sa.staffId]);
      expect(own?.paymentRows.map((p) => p.id)).toEqual([sa.paymentId]);
      expect(own?.attachmentRows.map((r) => r.id)).toEqual([sa.attachmentId]);
      expect(own?.historyRows).toHaveLength(1);
      expect(own?.rescheduleRows.map((r) => r.reasonName)).toEqual(['Reason A']);
    });

    it('child reads of another tenant event are empty', async () => {
      expect(await repoA.findHistory(sb.eventId)).toEqual([]);
      expect(await repoA.findStaff(sb.eventId)).toEqual([]);
      expect(await repoA.findPayments(sb.eventId)).toEqual([]);
      expect(await repoA.findReschedules(sb.eventId)).toEqual([]);
      expect(await repoB.findHistory(sb.eventId)).toHaveLength(1);
      expect(await repoB.findStaff(sb.eventId)).toHaveLength(1);
      expect(await repoB.findPayments(sb.eventId)).toHaveLength(1);
      expect(await repoB.findReschedules(sb.eventId)).toHaveLength(1);
    });

    it('isAccessible, findForReschedule and findForSelectionsUpdate do not see another tenant event', async () => {
      expect(await repoA.isAccessible(sb.eventId)).toBe(false);
      expect(await repoA.isAccessible(sa.eventId)).toBe(true);
      expect(await repoA.findForReschedule(sb.eventId)).toBeUndefined();
      expect((await repoA.findForReschedule(sa.eventId))?.clientName).toBe('Client A');
      expect(await repoA.findForSelectionsUpdate(sb.eventId)).toBeUndefined();
      expect((await repoA.findForSelectionsUpdate(sa.eventId))?.quoteId).toBe(sa.quoteId);
    });

    it('isClosed does not read another tenant event', async () => {
      await testDb.update(events).set({ completedAt: new Date() }).where(eq(events.id, sb.eventId));
      expect(await repoA.isClosed(sb.eventId)).toBe(false);
      expect(await repoB.isClosed(sb.eventId)).toBe(true);
    });

    it('isStaffAssigned does not see another tenant assignment', async () => {
      expect(await repoA.isStaffAssigned(sb.eventId, sb.staffId)).toBe(false);
      expect(await repoB.isStaffAssigned(sb.eventId, sb.staffId)).toBe(true);
    });

    it('findStaffConflicts reports only the tenant clashes', async () => {
      const conflicts = await repoA.findStaffConflicts(sa.eventId, DATE);
      expect(conflicts).toEqual([
        expect.objectContaining({
          staffId: sa.staffId,
          name: 'Staff A',
          conflictingEvent: expect.objectContaining({ id: sa.event2Id }),
        }),
      ]);
      expect(await repoA.findStaffConflicts(sb.eventId, DATE)).toEqual([]);
    });

    it('findPendingSelectionsCandidates lists only the tenant events', async () => {
      const rows = await repoA.findPendingSelectionsCandidates();
      expect(rows.map((r) => r.id)).toEqual([sa.eventId]);
      expect(rows[0]?.clientName).toBe('Client A');
    });

    it('payment and attachment lookups ignore another tenant rows', async () => {
      expect(await repoA.findPaymentById(sb.paymentId)).toBeUndefined();
      expect((await repoA.findPaymentById(sa.paymentId))?.eventId).toBe(sa.eventId);
      const rows = await repoA.findAttachmentsByPaymentIds([sa.paymentId, sb.paymentId]);
      expect(rows.map((r) => r.id)).toEqual([sa.attachmentId]);
    });
  });

  describe('writes', () => {
    it('registerPayment on another tenant event does nothing; own payment is stamped', async () => {
      expect(
        await repoA.registerPayment(
          sb.eventId,
          { method: 'cash', amount: 1, paidAt: '2030-01-01' },
          a.userId,
        ),
      ).toBeUndefined();
      expect(await tenantRows(eventPayments, b.id)).toHaveLength(1);

      expect(
        await repoA.registerPayment(
          sa.eventId,
          { method: 'cash', amount: 700, paidAt: '2030-01-01' },
          a.userId,
        ),
      ).toBe('ok');
      expect(await tenantRows(eventPayments, a.id)).toHaveLength(2);
      const [event] = await testDb.select().from(events).where(eq(events.id, sa.eventId));
      expect(event).toMatchObject({ depositPaid: true, balancePaid: true });
      const history = await historyOf(a.id);
      expect(history.map((h) => h.type)).toContain('payment_registered');
      expect(await historyOf(b.id)).toHaveLength(1);
    });

    it('removePayment cannot reach another tenant payment', async () => {
      expect(await repoA.removePayment(sb.eventId, sb.paymentId, a.userId)).toBeUndefined();
      expect(await repoA.removePayment(sa.eventId, sb.paymentId, a.userId)).toBeUndefined();
      expect(await tenantRows(eventPayments, b.id)).toHaveLength(1);

      const res = await repoA.removePayment(sa.eventId, sa.paymentId, a.userId);
      expect(res?.attachmentKeys).toEqual([sa.attachmentKey]);
      expect(await tenantRows(eventPayments, a.id)).toHaveLength(0);
      expect((await historyOf(a.id)).map((h) => h.type)).toContain('payment_removed');
    });

    it('createAttachment stamps the tenant', async () => {
      const row = await repoA.createAttachment({
        paymentId: sa.paymentId,
        key: 'k',
        url: 'u',
        fileName: 'f.png',
        mimeType: 'image/png',
        size: 1,
        createdById: a.userId,
      });
      expect(row?.tenantId).toBe(a.id);
    });

    it('deleteAttachment cannot reach another tenant attachment', async () => {
      expect(await repoA.deleteAttachment(sb.eventId, sb.attachmentId)).toBeUndefined();
      expect(await repoA.deleteAttachment(sa.eventId, sb.attachmentId)).toBeUndefined();
      expect(await tenantRows(eventPaymentAttachments, b.id)).toHaveLength(1);
      expect((await repoA.deleteAttachment(sa.eventId, sa.attachmentId))?.key).toBe(
        sa.attachmentKey,
      );
    });

    it('markCompleted cannot reach another tenant event; own history is stamped', async () => {
      expect(await repoA.markCompleted(sb.eventId, a.userId)).toBeUndefined();
      const [bEvent] = await testDb.select().from(events).where(eq(events.id, sb.eventId));
      expect(bEvent?.completedAt).toBeNull();
      expect((await repoA.markCompleted(sa.eventId, a.userId))?.id).toBe(sa.eventId);
      expect((await historyOf(a.id)).map((h) => h.type)).toEqual(['completed', 'completed']);
      expect(await historyOf(b.id)).toHaveLength(1);
    });

    it('assignStaff stamps the assignment and history with the tenant', async () => {
      const row = await repoA.assignStaff(
        { eventId: sa.eventId, staffId: sa.freeStaffId },
        a.userId,
      );
      expect(row?.tenantId).toBe(a.id);
      const history = await historyOf(a.id);
      expect(history.find((h) => h.type === 'staff_assigned')?.data).toMatchObject({
        staffName: 'Free staff A',
      });
    });

    it('assignStaff never resolves the name of another tenant staff', async () => {
      await repoA.assignStaff({ eventId: sa.eventId, staffId: sb.freeStaffId }, a.userId);
      const history = await historyOf(a.id);
      expect(history.find((h) => h.type === 'staff_assigned')?.data).toMatchObject({
        staffName: null,
      });
    });

    it('removeStaff cannot reach another tenant assignment', async () => {
      expect(
        await repoA.removeStaff({ eventId: sb.eventId, staffId: sb.staffId }, a.userId),
      ).toBeUndefined();
      expect(await tenantRows(eventStaff, b.id)).toHaveLength(2);
      expect(
        await repoA.removeStaff({ eventId: sa.eventId, staffId: sa.staffId }, a.userId),
      ).toBeDefined();
      const history = await historyOf(a.id);
      expect(history.find((h) => h.type === 'staff_removed')?.data).toMatchObject({
        staffName: 'Staff A',
      });
    });

    it('reschedule cannot reach another tenant event or quote; own rows are stamped', async () => {
      const write = (eventId: string, quoteId: string) => ({
        eventId,
        quoteId,
        from: { date: DATE, time: null },
        to: { date: '2030-07-01', time: null },
        reasonId: sa.reasonId,
        reasonName: 'Reason A',
        staffConflicts: [],
        userId: a.userId,
      });
      expect(await repoA.reschedule(write(sb.eventId, sb.quoteId))).toBeUndefined();
      const [bEvent] = await testDb.select().from(events).where(eq(events.id, sb.eventId));
      expect(bEvent?.eventDate).toBe(DATE);
      expect(await tenantRows(notifications, b.id)).toHaveLength(1);

      // Own event, but a quote id of B: only the A event moves.
      expect((await repoA.reschedule(write(sa.eventId, sb.quoteId)))?.id).toBe(sa.eventId);
      const [bQuote] = await testDb.select().from(quotes).where(eq(quotes.id, sb.quoteId));
      expect(bQuote?.eventDate).toBe(DATE);

      expect((await tenantRows(eventReschedules, a.id)).length).toBe(2);
      expect(await tenantRows(eventReschedules, b.id)).toHaveLength(1);
      expect(await tenantRows(notifications, a.id)).toHaveLength(0);
    });

    it('reschedule moves the own quote', async () => {
      await repoA.reschedule({
        eventId: sa.eventId,
        quoteId: sa.quoteId,
        from: { date: DATE, time: null },
        to: { date: '2030-07-01', time: '20:00' },
        reasonId: sa.reasonId,
        reasonName: 'Reason A',
        staffConflicts: [],
        userId: a.userId,
      });
      const [aQuote] = await testDb.select().from(quotes).where(eq(quotes.id, sa.quoteId));
      expect(aQuote).toMatchObject({ eventDate: '2030-07-01', eventTime: '20:00' });
    });

    it('updateSelections cannot reach another tenant event or option rows', async () => {
      await testDb.insert(quoteLineOptions).values({
        tenantId: b.id,
        quoteLineId: sb.lineId,
        optionId: sb.optionId,
        optionGroupId: sb.groupId,
      });
      const clear = [{ quoteLineId: sb.lineId, optionGroupId: sb.groupId, optionIds: [] }];
      expect(await repoA.updateSelections(sb.eventId, clear, a.userId)).toBeUndefined();
      expect(await tenantRows(quoteLineOptions, b.id)).toHaveLength(1);
      // Own event with a line id of B: the B rows still survive.
      expect((await repoA.updateSelections(sa.eventId, clear, a.userId))?.id).toBe(sa.eventId);
      expect(await tenantRows(quoteLineOptions, b.id)).toHaveLength(1);
      const [bEvent] = await testDb.select().from(events).where(eq(events.id, sb.eventId));
      expect(bEvent?.selectionsConfirmedAt).toBeNull();
    });

    it('updateSelections stamps the inserted option rows and history', async () => {
      const updated = await repoA.updateSelections(
        sa.eventId,
        [{ quoteLineId: sa.lineId, optionGroupId: sa.groupId, optionIds: [sa.optionId] }],
        a.userId,
      );
      expect(updated?.id).toBe(sa.eventId);
      expect(await tenantRows(quoteLineOptions, a.id)).toHaveLength(1);
      expect((await historyOf(a.id)).map((h) => h.type)).toContain('selections_updated');
    });
  });

  // Rows whose own tenant differs from the rows they point at. They cannot be produced through the
  // API, but they pin every filter on joined and child tables individually.
  describe('stray rows', () => {
    it('a B event on an A quote and client is invisible and immutable for A', async () => {
      const stray = await insertStrayEvent({
        tenantId: b.id,
        quoteId: sa.freeQuoteId,
        clientId: sa.clientId,
      });
      await testDb.insert(quoteLines).values({
        tenantId: a.id,
        quoteId: sa.freeQuoteId,
        productId: sa.productId,
        numPersons: 1,
        subtotal: 1,
      });
      const list = await repoA.findPaginated(
        eventsListQuerySchema.parse({ segment: 'all', page: 1, pageSize: 10 }),
      );
      expect(list.items.map((e) => e.id)).not.toContain(stray);
      expect(list.total).toBe(2);
      expect(
        (await repoA.findCalendarRange({ month: 6, year: 2030 })).map((e) => e.id),
      ).not.toContain(stray);
      expect(await repoA.findById(stray)).toBeUndefined();
      expect(await repoA.isAccessible(stray)).toBe(false);
      expect(await repoA.findForReschedule(stray)).toBeUndefined();
      expect(await repoA.findForSelectionsUpdate(stray)).toBeUndefined();
      expect((await repoA.findPendingSelectionsCandidates()).map((r) => r.id)).not.toContain(stray);
      expect(
        await repoA.registerPayment(
          stray,
          { method: 'cash', amount: 1, paidAt: '2030-01-01' },
          a.userId,
        ),
      ).toBeUndefined();
      expect(await repoA.markCompleted(stray, a.userId)).toBeUndefined();
      expect(await repoA.updateSelections(stray, [], a.userId)).toBeUndefined();
      expect(
        await repoA.reschedule({
          eventId: stray,
          quoteId: sa.freeQuoteId,
          from: { date: DATE, time: null },
          to: { date: '2030-07-01', time: null },
          reasonId: sa.reasonId,
          reasonName: 'x',
          staffConflicts: [],
          userId: a.userId,
        }),
      ).toBeUndefined();
      const [row] = await testDb.select().from(events).where(eq(events.id, stray));
      expect(row).toMatchObject({
        completedAt: null,
        eventDate: DATE,
        selectionsConfirmedAt: null,
      });
    });

    it('isClosed ignores a completed B event on an A quote', async () => {
      const stray = await insertStrayEvent({
        tenantId: b.id,
        quoteId: sa.freeQuoteId,
        clientId: sa.clientId,
        completedAt: new Date(),
      });
      expect(await repoA.isClosed(stray)).toBe(false);
    });

    it('an A event on a B quote is invisible for A', async () => {
      const stray = await insertStrayEvent({
        tenantId: a.id,
        quoteId: sb.freeQuoteId,
        clientId: sa.clientId,
      });
      await testDb.insert(quoteLines).values({
        tenantId: a.id,
        quoteId: sb.freeQuoteId,
        productId: sa.productId,
        numPersons: 1,
        subtotal: 1,
      });
      const list = await repoA.findPaginated(
        eventsListQuerySchema.parse({ segment: 'all', page: 1, pageSize: 10 }),
      );
      expect(list.items.map((e) => e.id)).not.toContain(stray);
      expect(list.total).toBe(2);
      expect(await repoA.isAccessible(stray)).toBe(false);
      expect(await repoA.findForReschedule(stray)).toBeUndefined();
      expect((await repoA.findPendingSelectionsCandidates()).map((r) => r.id)).not.toContain(stray);
      expect(
        await repoA.registerPayment(
          stray,
          { method: 'cash', amount: 1, paidAt: '2030-01-01' },
          a.userId,
        ),
      ).toBeUndefined();
      const payment = await insertPayment(a.id, stray, 1);
      expect(await repoA.findPaymentById(payment)).toBeUndefined();
    });

    it('isClosed ignores a cancelled B quote behind an A event', async () => {
      await testDb.update(quotes).set({ stageId: 4 }).where(eq(quotes.id, sb.freeQuoteId));
      const stray = await insertStrayEvent({
        tenantId: a.id,
        quoteId: sb.freeQuoteId,
        clientId: sa.clientId,
      });
      expect(await repoA.isClosed(stray)).toBe(false);
    });

    it('removePayment never reads the deposit of a B quote behind an A event', async () => {
      const stray = await insertStrayEvent({
        tenantId: a.id,
        quoteId: sb.freeQuoteId,
        clientId: sa.clientId,
        totalAmount: 100,
      });
      await insertPayment(a.id, stray, 100);
      const extra = await insertPayment(a.id, stray, 50);
      await repoA.removePayment(stray, extra, a.userId);
      const [row] = await testDb.select().from(events).where(eq(events.id, stray));
      expect(row).toMatchObject({ depositPaid: false, balancePaid: false });
    });

    it('an A event on a B client is not listed and never shows B names', async () => {
      await testDb.update(events).set({ clientId: sb.clientId }).where(eq(events.id, sa.event2Id));
      await testDb
        .update(events)
        .set({ eventTypeId: sb.eventTypeId })
        .where(eq(events.id, sa.eventId));
      const list = await repoA.findPaginated(
        eventsListQuerySchema.parse({ segment: 'all', page: 1, pageSize: 10 }),
      );
      expect(list.items.map((e) => e.id)).toEqual([sa.eventId]);
      expect(list.total).toBe(1);
      expect(list.items[0]?.eventTypeName).toBeNull();
      expect(await repoA.findById(sa.event2Id)).toBeUndefined();
      expect(await repoA.findForReschedule(sa.event2Id)).toBeUndefined();
      await testDb.update(events).set({ clientId: sb.clientId }).where(eq(events.id, sa.eventId));
      expect(await repoA.findPendingSelectionsCandidates()).toEqual([]);
    });

    it('a B payment on an A event never counts for A', async () => {
      const strayPayment = await insertPayment(b.id, sa.eventId, 600);
      const list = await repoA.findPaginated(allEvents());
      expect(Number(list.items.find((e) => e.id === sa.eventId)?.totalPaid)).toBe(300);
      expect((await repoA.findPayments(sa.eventId)).map((p) => p.id)).toEqual([sa.paymentId]);
      expect(await repoA.findPaymentById(strayPayment)).toBeUndefined();
      expect(await repoA.removePayment(sa.eventId, strayPayment, a.userId)).toBeUndefined();
      // 300 + 700 fits the 1000 total only if the stray 600 is not summed.
      expect(
        await repoA.registerPayment(
          sa.eventId,
          { method: 'cash', amount: 700, paidAt: '2030-01-01' },
          a.userId,
        ),
      ).toBe('ok');
    });

    it('removePayment recomputes the balance from own payments only', async () => {
      await insertPayment(b.id, sa.eventId, 900);
      const second = await insertPayment(a.id, sa.eventId, 100);
      await repoA.removePayment(sa.eventId, second, a.userId);
      const [row] = await testDb.select().from(events).where(eq(events.id, sa.eventId));
      expect(row).toMatchObject({ depositPaid: true, balancePaid: false });
    });

    it('an A payment on a B event is not found for A', async () => {
      const payment = await insertPayment(a.id, sb.eventId, 1);
      expect(await repoA.findPaymentById(payment)).toBeUndefined();
    });

    it('B attachments on an A payment are ignored', async () => {
      const [stray] = await testDb
        .insert(eventPaymentAttachments)
        .values({
          tenantId: b.id,
          paymentId: sa.paymentId,
          key: 'stray-key',
          url: 'u',
          fileName: 'f',
          mimeType: 'image/png',
          size: 1,
        })
        .returning({ id: eventPaymentAttachments.id });
      expect((await repoA.findAttachmentsByPaymentIds([sa.paymentId])).map((r) => r.id)).toEqual([
        sa.attachmentId,
      ]);
      expect(await repoA.deleteAttachment(sa.eventId, stray!.id)).toBeUndefined();
      const res = await repoA.removePayment(sa.eventId, sa.paymentId, a.userId);
      expect(res?.attachmentKeys).toEqual([sa.attachmentKey]);
    });

    it('an A attachment on a B payment of an A event cannot be deleted by A', async () => {
      const strayPayment = await insertPayment(b.id, sa.eventId, 1);
      const [attachment] = await testDb
        .insert(eventPaymentAttachments)
        .values({
          tenantId: a.id,
          paymentId: strayPayment,
          key: 'k',
          url: 'u',
          fileName: 'f',
          mimeType: 'image/png',
          size: 1,
        })
        .returning({ id: eventPaymentAttachments.id });
      expect(await repoA.deleteAttachment(sa.eventId, attachment!.id)).toBeUndefined();
    });

    it('an A payment on a B event of an A quote is not found for A', async () => {
      // The B event points at an A quote, so only the event filter can drop it.
      const stray = await insertStrayEvent({
        tenantId: b.id,
        quoteId: sa.freeQuoteId,
        clientId: sa.clientId,
      });
      const payment = await insertPayment(a.id, stray, 1);
      expect(await repoA.findPaymentById(payment)).toBeUndefined();
    });

    it('removePayment of an A payment on a B event never writes the B event', async () => {
      const payment = await insertPayment(a.id, sb.eventId, 1);
      await testDb.update(events).set({ depositPaid: true }).where(eq(events.id, sb.eventId));
      await repoA.removePayment(sb.eventId, payment, a.userId);
      const [row] = await testDb.select().from(events).where(eq(events.id, sb.eventId));
      expect(row?.depositPaid).toBe(true);
    });

    it('B assignments of A staff on an A event are ignored', async () => {
      await testDb
        .insert(eventStaff)
        .values({ tenantId: b.id, eventId: sa.eventId, staffId: sa.freeStaffId });
      expect((await repoA.findStaff(sa.eventId)).map((s) => s.staffId)).toEqual([sa.staffId]);
      const list = await repoA.findPaginated(allEvents());
      expect(list.items.find((e) => e.id === sa.eventId)?.staff.map((s) => s.staffId)).toEqual([
        sa.staffId,
      ]);
    });

    it('B staff assignments on an A event are ignored', async () => {
      await testDb
        .insert(eventStaff)
        .values({ tenantId: b.id, eventId: sa.eventId, staffId: sb.staffId });
      expect((await repoA.findStaff(sa.eventId)).map((s) => s.staffId)).toEqual([sa.staffId]);
      const list = await repoA.findPaginated(allEvents());
      expect(list.items.find((e) => e.id === sa.eventId)?.staff.map((s) => s.staffId)).toEqual([
        sa.staffId,
      ]);
      expect(await repoA.isStaffAssigned(sa.eventId, sb.staffId)).toBe(false);
      expect(
        await repoA.removeStaff({ eventId: sa.eventId, staffId: sb.staffId }, a.userId),
      ).toBeUndefined();
      expect(await tenantRows(eventStaff, b.id)).toHaveLength(3);
      expect(await repoA.findStaffConflicts(sa.eventId, DATE)).toHaveLength(1);
    });

    it('A assignments pointing at B staff never show the B staff', async () => {
      await testDb.insert(eventStaff).values([
        { tenantId: a.id, eventId: sa.eventId, staffId: sb.freeStaffId },
        { tenantId: a.id, eventId: sa.event2Id, staffId: sb.freeStaffId },
      ]);
      expect((await repoA.findStaff(sa.eventId)).map((s) => s.staffId)).toEqual([sa.staffId]);
      expect((await repoA.findStaffConflicts(sa.eventId, DATE)).map((c) => c.staffId)).toEqual([
        sa.staffId,
      ]);
      const list = await repoA.findPaginated(allEvents());
      expect(list.items.find((e) => e.id === sa.eventId)?.staff.map((s) => s.staffId)).toEqual([
        sa.staffId,
      ]);
      await repoA.removeStaff({ eventId: sa.eventId, staffId: sb.freeStaffId }, a.userId);
      const history = await historyOf(a.id);
      expect(history.find((h) => h.type === 'staff_removed')?.data).toMatchObject({
        staffName: null,
      });
    });

    it('a staff conflict through another tenant row is not reported', async () => {
      // The second A assignment becomes a B row: the clash disappears for A.
      await testDb
        .update(eventStaff)
        .set({ tenantId: b.id })
        .where(and(eq(eventStaff.eventId, sa.event2Id), eq(eventStaff.staffId, sa.staffId)));
      expect(await repoA.findStaffConflicts(sa.eventId, DATE)).toEqual([]);
    });

    it('a staff conflict for an A staff on a B event is not reported', async () => {
      await testDb
        .insert(eventStaff)
        .values({ tenantId: b.id, eventId: sb.event2Id, staffId: sa.freeStaffId });
      await testDb
        .insert(eventStaff)
        .values({ tenantId: a.id, eventId: sa.eventId, staffId: sa.freeStaffId });
      const conflicts = await repoA.findStaffConflicts(sa.eventId, DATE);
      expect(conflicts.map((c) => c.staffId)).toEqual([sa.staffId]);
    });

    it('the clashing assignment of A staff for a B event via A row is not reported', async () => {
      // An A assignment row on a B event: the B event must not count as a clash.
      await testDb
        .insert(eventStaff)
        .values({ tenantId: a.id, eventId: sb.event2Id, staffId: sa.freeStaffId });
      await testDb
        .insert(eventStaff)
        .values({ tenantId: a.id, eventId: sa.eventId, staffId: sa.freeStaffId });
      const conflicts = await repoA.findStaffConflicts(sa.eventId, DATE);
      expect(conflicts.map((c) => c.staffId)).toEqual([sa.staffId]);
    });

    it('the current assignment rows of another tenant do not produce conflicts', async () => {
      await testDb
        .insert(eventStaff)
        .values({ tenantId: b.id, eventId: sa.eventId, staffId: sa.freeStaffId });
      await testDb
        .insert(eventStaff)
        .values({ tenantId: a.id, eventId: sa.event2Id, staffId: sa.freeStaffId });
      const conflicts = await repoA.findStaffConflicts(sa.eventId, DATE);
      expect(conflicts.map((c) => c.staffId)).toEqual([sa.staffId]);
    });

    it('a conflict through a B quote behind an A event is not reported', async () => {
      const stray = await insertStrayEvent({
        tenantId: a.id,
        quoteId: sb.freeQuoteId,
        clientId: sa.clientId,
      });
      await testDb
        .insert(eventStaff)
        .values({ tenantId: a.id, eventId: stray, staffId: sa.freeStaffId });
      await testDb
        .insert(eventStaff)
        .values({ tenantId: a.id, eventId: sa.eventId, staffId: sa.freeStaffId });
      const conflicts = await repoA.findStaffConflicts(sa.eventId, DATE);
      expect(conflicts.map((c) => c.staffId)).toEqual([sa.staffId]);
    });

    it('an A assignment on a B event of an A quote is not a conflict', async () => {
      const stray = await insertStrayEvent({
        tenantId: b.id,
        quoteId: sa.freeQuoteId,
        clientId: sa.clientId,
      });
      await testDb.insert(eventStaff).values([
        { tenantId: a.id, eventId: stray, staffId: sa.freeStaffId },
        { tenantId: a.id, eventId: sa.eventId, staffId: sa.freeStaffId },
      ]);
      const conflicts = await repoA.findStaffConflicts(sa.eventId, DATE);
      expect(conflicts.map((c) => c.staffId)).toEqual([sa.staffId]);
    });

    it('a B reschedule with an A reason on an A event is ignored', async () => {
      await testDb.insert(eventReschedules).values({
        tenantId: b.id,
        eventId: sa.eventId,
        toDate: DATE,
        reasonId: sa.reasonId,
      });
      expect(await repoA.findReschedules(sa.eventId)).toHaveLength(1);
    });

    it('B history and reschedules on an A event are ignored', async () => {
      await testDb
        .insert(eventHistory)
        .values({ tenantId: b.id, eventId: sa.eventId, type: 'completed', data: {} });
      await testDb.insert(eventReschedules).values({
        tenantId: b.id,
        eventId: sa.eventId,
        toDate: DATE,
        reasonId: sb.reasonId,
      });
      expect(await repoA.findHistory(sa.eventId)).toHaveLength(1);
      expect(await repoA.findReschedules(sa.eventId)).toHaveLength(1);
    });

    it('an A reschedule pointing at a B reason is not shown with the B name', async () => {
      await testDb.insert(eventReschedules).values({
        tenantId: a.id,
        eventId: sa.eventId,
        toDate: DATE,
        reasonId: sb.reasonId,
      });
      expect((await repoA.findReschedules(sa.eventId)).map((r) => r.reasonName)).toEqual([
        'Reason A',
      ]);
    });

    it('reschedule does not delete a B reminder pointing at the A event', async () => {
      await testDb.insert(notifications).values({
        tenantId: b.id,
        type: 'event_selections_reminder',
        data: {},
        entityType: 'event',
        entityId: sa.eventId,
      });
      await repoA.reschedule({
        eventId: sa.eventId,
        quoteId: sa.quoteId,
        from: { date: DATE, time: null },
        to: { date: '2030-07-01', time: null },
        reasonId: sa.reasonId,
        reasonName: 'Reason A',
        staffConflicts: [],
        userId: a.userId,
      });
      expect(await tenantRows(notifications, a.id)).toHaveLength(0);
      expect(await tenantRows(notifications, b.id)).toHaveLength(2);
    });

    it('B quote lines and options on A quotes are ignored', async () => {
      await testDb.insert(quoteLines).values({
        tenantId: b.id,
        quoteId: sa.quoteId,
        productId: sb.productId,
        numPersons: 1,
        subtotal: 1,
      });
      await testDb.insert(quoteLineOptions).values({
        tenantId: b.id,
        quoteLineId: sa.lineId,
        optionId: sb.optionId,
        optionGroupId: sb.groupId,
      });
      const own = await repoA.findById(sa.eventId);
      expect(own?.lineRows.map((l) => l.id)).toEqual([sa.lineId]);
      expect(own?.optionRows).toEqual([]);
    });

    it('a B line on an A quote does not make its event incomplete', async () => {
      await testDb.insert(quoteLines).values({
        tenantId: b.id,
        quoteId: sa.quote2Id,
        productId: sa.productId,
        numPersons: 1,
        subtotal: 1,
      });
      expect((await repoA.findById(sa.event2Id))?.selectionsIncomplete).toBe(false);
      expect((await repoA.findPendingSelectionsCandidates()).map((r) => r.id)).toEqual([
        sa.eventId,
      ]);
    });

    it('a B select group on an A product does not make an A event incomplete', async () => {
      await testDb.insert(quoteLineOptions).values({
        tenantId: a.id,
        quoteLineId: sa.lineId,
        optionId: sa.optionId,
        optionGroupId: sa.groupId,
      });
      expect((await repoA.findById(sa.eventId))?.selectionsIncomplete).toBe(false);
      await testDb
        .insert(optionGroups)
        .values({ tenantId: b.id, productId: sa.productId, label: 'stray group' });
      expect((await repoA.findById(sa.eventId))?.selectionsIncomplete).toBe(false);
      expect(await repoA.findPendingSelectionsCandidates()).toEqual([]);
    });

    it('a B option row does not complete an A selection', async () => {
      await testDb.insert(quoteLineOptions).values({
        tenantId: b.id,
        quoteLineId: sa.lineId,
        optionId: sa.optionId,
        optionGroupId: sa.groupId,
      });
      expect((await repoA.findById(sa.eventId))?.selectionsIncomplete).toBe(true);
      expect((await repoA.findPendingSelectionsCandidates()).map((r) => r.id)).toEqual([
        sa.eventId,
      ]);
    });

    it('updateSelections does not delete B option rows on an A line', async () => {
      await testDb.insert(quoteLineOptions).values({
        tenantId: b.id,
        quoteLineId: sa.lineId,
        optionId: sb.optionId,
        optionGroupId: sa.groupId,
      });
      await repoA.updateSelections(
        sa.eventId,
        [{ quoteLineId: sa.lineId, optionGroupId: sa.groupId, optionIds: [] }],
        a.userId,
      );
      expect(await tenantRows(quoteLineOptions, b.id)).toHaveLength(1);
    });
  });

  // FK rule: every id from the input is resolved inside the tenant before anything is written.
  describe('service', () => {
    it('getById, markCompleted and registerPayment reject another tenant event', async () => {
      const service = serviceFor(a);
      await expect(service.getById(sb.eventId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        cause: { code: 'EVENT_NOT_FOUND' },
      });
      await expect(service.markCompleted(sb.eventId, a.userId)).rejects.toMatchObject({
        cause: { code: 'EVENT_NOT_FOUND' },
      });
      await expect(
        service.registerPayment(
          sb.eventId,
          { method: 'cash', amount: 1, paidAt: '2030-01-01' },
          a.userId,
        ),
      ).rejects.toMatchObject({ cause: { code: 'EVENT_NOT_FOUND' } });
      expect(await tenantRows(eventPayments, a.id)).toHaveLength(1);
      expect(await tenantRows(eventPayments, b.id)).toHaveLength(1);
    });

    it('assignStaff rejects another tenant staff as not found and inserts nothing', async () => {
      const service = serviceFor(a);
      await expect(
        service.assignStaff({ eventId: sa.eventId, staffId: sb.freeStaffId }, a.userId),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'STAFF_NOT_FOUND' } });
      await expect(
        service.assignStaff(
          { eventId: sa.eventId, staffId: '00000000-0000-4000-8000-000000000000' },
          a.userId,
        ),
      ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'STAFF_NOT_FOUND' } });
      expect(await tenantRows(eventStaff, a.id)).toHaveLength(2);
      await expect(
        service.assignStaff({ eventId: sb.eventId, staffId: sa.freeStaffId }, a.userId),
      ).rejects.toMatchObject({ cause: { code: 'EVENT_NOT_FOUND' } });
      const row = await service.assignStaff(
        { eventId: sa.eventId, staffId: sa.freeStaffId },
        a.userId,
      );
      expect(row?.tenantId).toBe(a.id);
    });

    it('updateSelections rejects another tenant lines, groups and options', async () => {
      const service = serviceFor(a);
      const run = (selection: {
        quoteLineId: string;
        optionGroupId: string;
        optionIds: string[];
      }) =>
        service.updateSelections(
          sa.eventId,
          { eventId: sa.eventId, selections: [selection] },
          a.userId,
        );
      await expect(
        run({ quoteLineId: sb.lineId, optionGroupId: sb.groupId, optionIds: [] }),
      ).rejects.toMatchObject({ cause: { code: 'EVENT_INVALID_SELECTIONS' } });
      await expect(
        run({ quoteLineId: sa.lineId, optionGroupId: sb.groupId, optionIds: [sb.optionId] }),
      ).rejects.toMatchObject({ cause: { code: 'EVENT_INVALID_SELECTIONS' } });
      await expect(
        run({ quoteLineId: sa.lineId, optionGroupId: sa.groupId, optionIds: [sb.optionId] }),
      ).rejects.toMatchObject({ cause: { code: 'EVENT_INVALID_SELECTIONS' } });
      expect(await tenantRows(quoteLineOptions, a.id)).toHaveLength(0);
      await expect(
        service.updateSelections(sb.eventId, { eventId: sb.eventId, selections: [] }, a.userId),
      ).rejects.toMatchObject({ cause: { code: 'EVENT_NOT_FOUND' } });

      await run({ quoteLineId: sa.lineId, optionGroupId: sa.groupId, optionIds: [sa.optionId] });
      expect(await tenantRows(quoteLineOptions, a.id)).toHaveLength(1);
    });

    it('reschedule rejects another tenant reason and changes nothing', async () => {
      const service = serviceFor(a);
      const actor = { name: 'A', image: null };
      await expect(
        service.reschedule(
          { eventId: sa.eventId, eventDate: '2030-07-01', reasonId: sb.reasonId },
          a.userId,
          actor,
        ),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        cause: { code: 'RESCHEDULE_REASON_NOT_FOUND' },
      });
      const [row] = await testDb.select().from(events).where(eq(events.id, sa.eventId));
      expect(row?.eventDate).toBe(DATE);
      expect(await tenantRows(eventReschedules, a.id)).toHaveLength(1);
    });

    it('reschedule stamps the notification with the tenant', async () => {
      const service = serviceFor(a);
      await service.reschedule(
        { eventId: sa.eventId, eventDate: '2030-07-01', reasonId: sa.reasonId },
        a.userId,
        { name: 'A', image: null },
      );
      const rows = await testDb
        .select({ type: notifications.type })
        .from(notifications)
        .where(eq(notifications.tenantId, a.id));
      expect(rows.map((n) => n.type)).toEqual(['event_rescheduled']);
      expect(await tenantRows(notifications, b.id)).toHaveLength(1);
    });

    it('checkReschedule reports only the tenant bookings and conflicts', async () => {
      const res = await serviceFor(a).checkReschedule({ eventId: sa.eventId, eventDate: DATE });
      expect(res.eventConflicts.map((c) => c.id).sort()).toEqual(
        [sa.quote2Id, sa.freeQuoteId].sort(),
      );
      expect(res.staffConflicts.map((c) => c.staffId)).toEqual([sa.staffId]);
      await expect(
        serviceFor(a).checkReschedule({ eventId: sb.eventId, eventDate: DATE }),
      ).rejects.toMatchObject({ cause: { code: 'EVENT_NOT_FOUND' } });
    });

    it('payment and attachment removals reject another tenant ids and keep storage intact', async () => {
      const storage = fakeStorage();
      const service = serviceFor(a, storage);
      await expect(service.removePayment(sa.eventId, sb.paymentId, a.userId)).rejects.toMatchObject(
        { cause: { code: 'EVENT_PAYMENT_NOT_FOUND' } },
      );
      await expect(
        service.removePaymentAttachment({ eventId: sa.eventId, attachmentId: sb.attachmentId }),
      ).rejects.toMatchObject({ cause: { code: 'EVENT_PAYMENT_ATTACHMENT_NOT_FOUND' } });
      expect(storage.delete).not.toHaveBeenCalled();
      expect(await tenantRows(eventPaymentAttachments, b.id)).toHaveLength(1);

      await service.removePaymentAttachment({ eventId: sa.eventId, attachmentId: sa.attachmentId });
      expect(storage.delete).toHaveBeenCalledWith(sa.attachmentKey);
    });

    it('addPaymentAttachment rejects another tenant payment before uploading', async () => {
      const storage = fakeStorage();
      const service = serviceFor(a, storage);
      const file = {
        buffer: Buffer.from('x'),
        mimetype: 'image/png',
        originalname: 'p.png',
        size: 1,
      };
      await expect(
        service.addPaymentAttachment(sb.paymentId, file, a.userId),
      ).rejects.toMatchObject({
        code: 'EVENT_PAYMENT_NOT_FOUND',
        status: 404,
      });
      expect(storage.upload).not.toHaveBeenCalled();

      const created = await service.addPaymentAttachment(sa.paymentId, file, a.userId);
      const key = storage.upload.mock.calls[0]![0].key;
      expect(key).toMatch(new RegExp(`^t/${a.id}/event-payments/[0-9a-f-]{36}\\.png$`));
      const [row] = await testDb
        .select()
        .from(eventPaymentAttachments)
        .where(eq(eventPaymentAttachments.id, created.id));
      expect(row).toMatchObject({ tenantId: a.id, key });
    });
  });
});
