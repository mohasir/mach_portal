import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { QUOTE_STAGE } from '@repo/schemas';
import {
  appSettings,
  clients,
  events,
  notifications,
  optionGroups,
  products,
  quoteLines,
  quotes,
} from '../../db/schema';
import { addDays, todayInBusinessTimezone } from '../../lib/utils/date';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../test/db';
import { seedQuoteStages } from '../../test/fixtures/events';
import { checkEventSelectionsReminders } from '../eventReminders.job';

// Inside the 3-day lead window only when the tenant's deadline setting is >= 2 days.
const EVENT_DATE = () => addDays(todayInBusinessTimezone(), 5);

async function seedPendingEvent(
  tenant: TestTenant,
  label: string,
  eventDate = EVENT_DATE(),
  seq = 1,
) {
  const t = tenant.id;
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId: t, name: `Client ${label}` })
    .returning({ id: clients.id });
  const [product] = await testDb
    .insert(products)
    .values({ tenantId: t, name: `Menu ${label}` })
    .returning({ id: products.id });
  await testDb
    .insert(optionGroups)
    .values({ tenantId: t, productId: product!.id, label: `Group ${label}` });
  const [quote] = await testDb
    .insert(quotes)
    .values({
      tenantId: t,
      clientId: client!.id,
      eventDate,
      eventTime: '18:00',
      taxRate: 0.08,
      depositAmount: 0,
      createdById: tenant.userId,
      assignedToId: tenant.userId,
      seq,
      number: `QUO-${String(seq).padStart(6, '0')}`,
      stageId: QUOTE_STAGE.CONFIRMED,
    })
    .returning({ id: quotes.id });
  await testDb.insert(quoteLines).values({
    tenantId: t,
    quoteId: quote!.id,
    productId: product!.id,
    numPersons: 10,
    subtotal: 1000,
  });
  const [event] = await testDb
    .insert(events)
    .values({
      tenantId: t,
      quoteId: quote!.id,
      clientId: client!.id,
      eventDate,
      eventTime: '18:00',
      totalAmount: 1000,
    })
    .returning({ id: events.id });
  return event!.id;
}

const remindersOf = (tenantId: string) =>
  testDb.select().from(notifications).where(eq(notifications.tenantId, tenantId));

describe('checkEventSelectionsReminders', () => {
  let a: TestTenant;
  let b: TestTenant;
  let eventA: string;
  let eventB: string;

  beforeEach(async () => {
    await resetDb();
    await seedQuoteStages();
    ({ a, b } = await seedTwoTenants());
    await testDb.insert(appSettings).values([
      { tenantId: a.id, optionsSelectionDeadlineDays: 2 },
      { tenantId: b.id, optionsSelectionDeadlineDays: 2 },
    ]);
    eventA = await seedPendingEvent(a, 'A');
    eventB = await seedPendingEvent(b, 'B');
  });

  it('creates notifications only in the tenant it runs for', async () => {
    await checkEventSelectionsReminders(a.id);

    const rowsA = await remindersOf(a.id);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0]).toMatchObject({ type: 'event_selections_reminder', entityId: eventA });
    expect(await remindersOf(b.id)).toHaveLength(0);
  });

  it('does not duplicate reminders on a second run', async () => {
    await checkEventSelectionsReminders(a.id);
    await checkEventSelectionsReminders(a.id);

    expect(await remindersOf(a.id)).toHaveLength(1);
  });

  it('dedupes per tenant: existing reminders in A do not block B', async () => {
    await checkEventSelectionsReminders(a.id);
    await checkEventSelectionsReminders(b.id);

    const rowsB = await remindersOf(b.id);
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0]!.entityId).toBe(eventB);
    expect(await remindersOf(a.id)).toHaveLength(1);
  });

  it("uses each tenant's own selections deadline", async () => {
    await testDb
      .update(appSettings)
      .set({ optionsSelectionDeadlineDays: 0 })
      .where(eq(appSettings.tenantId, b.id));

    await checkEventSelectionsReminders(a.id);
    await checkEventSelectionsReminders(b.id);

    expect(await remindersOf(a.id)).toHaveLength(1);
    expect(await remindersOf(b.id)).toHaveLength(0);

    await testDb
      .update(appSettings)
      .set({ optionsSelectionDeadlineDays: 10 })
      .where(eq(appSettings.tenantId, b.id));
    await checkEventSelectionsReminders(b.id);

    expect(await remindersOf(b.id)).toHaveLength(1);
  });

  it('does not crash for a tenant without app_settings and treats the deadline as 0', async () => {
    await testDb.delete(appSettings).where(eq(appSettings.tenantId, b.id));
    const soon = await seedPendingEvent(b, 'B-soon', addDays(todayInBusinessTimezone(), 2), 2);

    await checkEventSelectionsReminders(b.id);

    // Deadline 0 days: only the event inside the 3-day window is due, not the one 5 days out.
    const rows = await remindersOf(b.id);
    expect(rows.map((r) => r.entityId)).toEqual([soon]);
  });
});
