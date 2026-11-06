import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { paymentsIncomeQuerySchema, paymentsListQuerySchema } from '@repo/schemas';
import { events } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import {
  insertPayment,
  insertStrayEvent,
  seedEventsTenant,
  seedQuoteStages,
  type EventsSeed,
} from '../../../test/fixtures/events';
import { PaymentsRepository } from '../payments.repository';

const list = (extra: Record<string, unknown> = {}) =>
  paymentsListQuerySchema.parse({ page: 1, pageSize: 50, ...extra });
const income = () => paymentsIncomeQuerySchema.parse({ groupBy: 'year' });

describe('payments tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let sa: EventsSeed;
  let sb: EventsSeed;
  let repoA: PaymentsRepository;
  let repoB: PaymentsRepository;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    await seedQuoteStages();
    sa = await seedEventsTenant(a, 'A');
    sb = await seedEventsTenant(b, 'B');
    repoA = new PaymentsRepository(testDb, a.id);
    repoB = new PaymentsRepository(testDb, b.id);
  });

  it('findPaginated lists and counts only the tenant payments', async () => {
    const res = await repoA.findPaginated(list());
    expect(res.items.map((p) => p.id)).toEqual([sa.paymentId]);
    expect(res.total).toBe(1);
    expect(res.items[0]).toMatchObject({ clientName: 'Client A', eventTypeName: 'Wedding A' });
    expect((await repoB.findPaginated(list())).items.map((p) => p.id)).toEqual([sb.paymentId]);
  });

  it('filters by another tenant client or event type return nothing', async () => {
    expect((await repoA.findPaginated(list({ clientIds: [sb.clientId] }))).items).toEqual([]);
    expect((await repoA.findPaginated(list({ eventTypeIds: [sb.eventTypeId] }))).items).toEqual([]);
  });

  it('findIncome aggregates only the tenant payments', async () => {
    expect(await repoA.findIncome(income())).toEqual([
      expect.objectContaining({ totalAmount: 300, count: 1 }),
    ]);
    expect(await repoB.findIncome(income())).toEqual([
      expect.objectContaining({ totalAmount: 300, count: 1 }),
    ]);
  });

  describe('stray rows', () => {
    it('a B payment on an A event is not listed, counted or summed', async () => {
      await insertPayment(b.id, sa.eventId, 600);
      const res = await repoA.findPaginated(list());
      expect(res.items.map((p) => p.id)).toEqual([sa.paymentId]);
      expect(res.total).toBe(1);
      expect(await repoA.findIncome(income())).toEqual([
        expect.objectContaining({ totalAmount: 300, count: 1 }),
      ]);
    });

    it('an A payment on a B event is not listed, counted or summed', async () => {
      // The B event points at an A quote and client, so only the event filter can drop it.
      const stray = await insertStrayEvent({
        tenantId: b.id,
        quoteId: sa.freeQuoteId,
        clientId: sa.clientId,
      });
      await insertPayment(a.id, stray, 600);
      const res = await repoA.findPaginated(list());
      expect(res.items.map((p) => p.id)).toEqual([sa.paymentId]);
      expect(res.total).toBe(1);
      expect(await repoA.findIncome(income())).toEqual([
        expect.objectContaining({ totalAmount: 300, count: 1 }),
      ]);
    });

    it('an A payment on an A event of a B quote is not listed, counted or summed', async () => {
      const stray = await insertStrayEvent({
        tenantId: a.id,
        quoteId: sb.freeQuoteId,
        clientId: sa.clientId,
      });
      await insertPayment(a.id, stray, 600);
      const res = await repoA.findPaginated(list());
      expect(res.items.map((p) => p.id)).toEqual([sa.paymentId]);
      expect(res.total).toBe(1);
      expect(await repoA.findIncome(income())).toEqual([
        expect.objectContaining({ totalAmount: 300, count: 1 }),
      ]);
    });

    it('an A event on a B client is dropped and a B event type is never shown', async () => {
      await testDb
        .update(events)
        .set({ eventTypeId: sb.eventTypeId })
        .where(eq(events.id, sa.eventId));
      expect((await repoA.findPaginated(list())).items[0]?.eventTypeName).toBeNull();
      await testDb.update(events).set({ clientId: sb.clientId }).where(eq(events.id, sa.eventId));
      const res = await repoA.findPaginated(list());
      expect(res.items).toEqual([]);
      expect(res.total).toBe(0);
    });
  });
});
