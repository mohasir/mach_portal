import { beforeEach, describe, expect, it } from 'vitest';
import { QUOTE_STAGE } from '@repo/schemas';
import { eventPayments, events, products, quoteLines, quotes, clients } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { seedQuoteStages } from '../../../test/fixtures/events';
import { DashboardRepository } from '../dashboard.repository';
import { DashboardService } from '../dashboard.service';

const YEAR = 2030;
const JUNE = 6;

type Spec = {
  confirmed: number;
  pending: number;
  otherMonths: Record<number, number>;
  productLines: [name: string, lines: number][];
  events: number;
  payments: number[];
};

type Seed = {
  clientId: string;
  confirmedQuoteIds: string[];
  eventIds: string[];
  productIds: Record<string, string>;
};

// Distinct values per tenant so every aggregate has a different, known expected number.
const SPEC_A: Spec = {
  confirmed: 3,
  pending: 1,
  otherMonths: { 1: 2 },
  productLines: [
    ['Menu A1', 3],
    ['Menu A2', 1],
  ],
  events: 2,
  payments: [300, 200],
};
const SPEC_B: Spec = {
  confirmed: 7,
  pending: 3,
  otherMonths: { 3: 1, 12: 2 },
  productLines: [
    ['Menu B1', 5],
    ['Menu B2', 2],
  ],
  events: 4,
  payments: [1000, 250, 50],
};

let counter = 0;
const nextNumber = () => {
  counter += 1;
  return { seq: counter, number: `QUO-${String(counter).padStart(6, '0')}` };
};

const created = (month: number) => new Date(Date.UTC(YEAR, month - 1, 10, 12));

async function insertQuote(
  tenant: TestTenant,
  clientId: string,
  values: { stageId: number; createdMonth: number; eventDate?: string },
) {
  const [row] = await testDb
    .insert(quotes)
    .values({
      tenantId: tenant.id,
      ...nextNumber(),
      clientId,
      stageId: values.stageId,
      eventDate: values.eventDate ?? null,
      taxRate: 0.08,
      createdAt: created(values.createdMonth),
    })
    .returning({ id: quotes.id });
  return row!.id;
}

async function seedTenant(tenant: TestTenant, label: string, spec: Spec): Promise<Seed> {
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId: tenant.id, name: `Client ${label}` })
    .returning({ id: clients.id });
  const clientId = client!.id;

  const productIds: Record<string, string> = {};
  for (const [name] of spec.productLines) {
    const [p] = await testDb
      .insert(products)
      .values({ tenantId: tenant.id, name })
      .returning({ id: products.id });
    productIds[name] = p!.id;
  }

  const confirmedQuoteIds: string[] = [];
  for (let i = 0; i < spec.confirmed; i++) {
    confirmedQuoteIds.push(
      await insertQuote(tenant, clientId, {
        stageId: QUOTE_STAGE.CONFIRMED,
        createdMonth: JUNE,
        eventDate: `${YEAR}-06-20`,
      }),
    );
  }
  for (let i = 0; i < spec.pending; i++) {
    await insertQuote(tenant, clientId, {
      stageId: QUOTE_STAGE.PENDING,
      createdMonth: JUNE,
      eventDate: `${YEAR}-06-21`,
    });
  }
  for (const [month, n] of Object.entries(spec.otherMonths)) {
    for (let i = 0; i < n; i++) {
      await insertQuote(tenant, clientId, {
        stageId: QUOTE_STAGE.PENDING,
        createdMonth: Number(month),
      });
    }
  }

  for (const [name, lines] of spec.productLines) {
    await testDb.insert(quoteLines).values(
      Array.from({ length: lines }, () => ({
        tenantId: tenant.id,
        quoteId: confirmedQuoteIds[0]!,
        productId: productIds[name]!,
        numPersons: 10,
        subtotal: 1000,
      })),
    );
  }

  const eventIds: string[] = [];
  for (const quoteId of confirmedQuoteIds.slice(0, spec.events)) {
    eventIds.push(await insertEvent(tenant.id, quoteId, clientId));
  }
  for (const amount of spec.payments) {
    await insertPayment(tenant.id, eventIds[0]!, amount);
  }
  return { clientId, confirmedQuoteIds, eventIds, productIds };
}

async function insertEvent(tenantId: string, quoteId: string, clientId: string) {
  const [row] = await testDb
    .insert(events)
    .values({
      tenantId,
      quoteId,
      clientId,
      eventDate: `${YEAR}-06-20`,
      eventTime: '18:00',
      totalAmount: 1000,
    })
    .returning({ id: events.id });
  return row!.id;
}

async function insertPayment(tenantId: string, eventId: string, amount: number) {
  await testDb
    .insert(eventPayments)
    .values({ tenantId, eventId, method: 'cash', amount, paidAt: `${YEAR}-06-15` });
}

describe('dashboard tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let sa: Seed;
  let sb: Seed;
  let svcA: DashboardService;
  let svcB: DashboardService;
  let repoA: DashboardRepository;

  const summaryQ = { month: JUNE, year: YEAR };
  const topQ = { month: JUNE, year: YEAR, limit: 10 };

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    await seedQuoteStages();
    sa = await seedTenant(a, 'A', SPEC_A);
    sb = await seedTenant(b, 'B', SPEC_B);
    repoA = new DashboardRepository(testDb, a.id);
    svcA = new DashboardService(repoA);
    svcB = new DashboardService(new DashboardRepository(testDb, b.id));
  });

  describe('aggregates', () => {
    it('summary returns only the tenant numbers', async () => {
      expect(await svcA.summary(summaryQ)).toEqual({
        eventsCount: 2,
        revenue: 500,
        quotesCount: 4,
        closeRate: 0.75,
      });
      expect(await svcB.summary(summaryQ)).toEqual({
        eventsCount: 4,
        revenue: 1300,
        quotesCount: 10,
        closeRate: 0.7,
      });
    });

    it('quotesByMonth returns only the tenant quotes', async () => {
      const counts = async (svc: DashboardService) =>
        (await svc.quotesByMonth({ year: YEAR })).map((m) => m.count);
      expect(await counts(svcA)).toEqual([2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0]);
      expect(await counts(svcB)).toEqual([0, 0, 1, 0, 0, 10, 0, 0, 0, 0, 0, 2]);
    });

    it('topProducts returns only the tenant products and total', async () => {
      expect(await svcA.topProducts(topQ)).toEqual({
        items: [
          { productId: sa.productIds['Menu A1'], productName: 'Menu A1', count: 3 },
          { productId: sa.productIds['Menu A2'], productName: 'Menu A2', count: 1 },
        ],
        total: 4,
      });
      expect(await svcB.topProducts(topQ)).toEqual({
        items: [
          { productId: sb.productIds['Menu B1'], productName: 'Menu B1', count: 5 },
          { productId: sb.productIds['Menu B2'], productName: 'Menu B2', count: 2 },
        ],
        total: 7,
      });
    });
  });

  // Rows whose own tenant_id disagrees with the parent they hang from: every joined table
  // must be filtered on its own, not just the base table.
  describe('stray rows', () => {
    it('ignores a B event hanging off an A quote', async () => {
      const eventId = await insertEvent(b.id, sa.confirmedQuoteIds[2]!, sb.clientId);
      await insertPayment(a.id, eventId, 999);
      expect(await repoA.countEvents(JUNE, YEAR)).toBe(2);
      expect(await repoA.sumRevenue(JUNE, YEAR)).toBe(500);
    });

    it('ignores an A event hanging off a B quote', async () => {
      const eventId = await insertEvent(a.id, sb.confirmedQuoteIds[6]!, sa.clientId);
      await insertPayment(a.id, eventId, 999);
      expect(await repoA.countEvents(JUNE, YEAR)).toBe(2);
      expect(await repoA.sumRevenue(JUNE, YEAR)).toBe(500);
    });

    it('ignores a B payment hanging off an A event', async () => {
      await insertPayment(b.id, sa.eventIds[0]!, 999);
      expect(await repoA.sumRevenue(JUNE, YEAR)).toBe(500);
    });

    it('ignores a B line hanging off an A quote', async () => {
      await testDb.insert(quoteLines).values({
        tenantId: b.id,
        quoteId: sa.confirmedQuoteIds[0]!,
        productId: sa.productIds['Menu A1']!,
        numPersons: 10,
        subtotal: 1000,
      });
      const res = await svcA.topProducts(topQ);
      expect(res.total).toBe(4);
      expect(res.items.map((i) => i.count)).toEqual([3, 1]);
    });

    it('ignores an A line hanging off a B quote', async () => {
      await testDb.insert(quoteLines).values({
        tenantId: a.id,
        quoteId: sb.confirmedQuoteIds[0]!,
        productId: sa.productIds['Menu A1']!,
        numPersons: 10,
        subtotal: 1000,
      });
      const res = await svcA.topProducts(topQ);
      expect(res.total).toBe(4);
      expect(res.items.map((i) => i.count)).toEqual([3, 1]);
    });

    it('ignores an A line pointing at a B product', async () => {
      await testDb.insert(quoteLines).values({
        tenantId: a.id,
        quoteId: sa.confirmedQuoteIds[0]!,
        productId: sb.productIds['Menu B1']!,
        numPersons: 10,
        subtotal: 1000,
      });
      const res = await svcA.topProducts(topQ);
      expect(res.items.map((i) => i.productName)).toEqual(['Menu A1', 'Menu A2']);
    });
  });
});
