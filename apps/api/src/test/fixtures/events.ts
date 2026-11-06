import { QUOTE_STAGE } from '@repo/schemas';
import {
  appSettings,
  clients,
  eventHistory,
  eventPaymentAttachments,
  eventPayments,
  eventReschedules,
  eventStaff,
  eventTypes,
  events,
  notifications,
  optionGroups,
  options,
  productPriceTiers,
  products,
  quoteLines,
  quoteStages,
  quotes,
  rescheduleReasons,
  staff,
} from '../../db/schema';
import { testDb, type TestTenant } from '../db';

export const DATE = '2030-06-01';
export const TIME = '18:00';

export type EventsSeed = {
  clientId: string;
  eventTypeId: string;
  staffId: string;
  freeStaffId: string;
  reasonId: string;
  productId: string;
  groupId: string;
  optionId: string;
  // CONFIRMED quote whose event has staff, a payment with an attachment, history, a reschedule,
  // a reminder notification and a line whose `select` group has no option chosen.
  quoteId: string;
  lineId: string;
  eventId: string;
  paymentId: string;
  attachmentId: string;
  attachmentKey: string;
  reminderId: string;
  // A second event on the same date sharing `staffId`, so the first one has a staff conflict.
  quote2Id: string;
  event2Id: string;
  // A quote without an event, free to receive stray events in tests.
  freeQuoteId: string;
};

export async function seedQuoteStages() {
  await testDb.insert(quoteStages).values(
    Object.values(QUOTE_STAGE).map((id) => ({
      id,
      label: `stage ${id}`,
      color: '#000000',
      sortOrder: id,
    })),
  );
}

export async function seedEventsTenant(tenant: TestTenant, label: string): Promise<EventsSeed> {
  const t = tenant.id;
  await testDb.insert(appSettings).values({ tenantId: t });
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId: t, name: `Client ${label}` })
    .returning({ id: clients.id });
  const [eventType] = await testDb
    .insert(eventTypes)
    .values({ tenantId: t, name: `Wedding ${label}` })
    .returning({ id: eventTypes.id });
  const [member, free] = await testDb
    .insert(staff)
    .values([
      { tenantId: t, name: `Staff ${label}` },
      { tenantId: t, name: `Free staff ${label}` },
    ])
    .returning({ id: staff.id });
  const [reason] = await testDb
    .insert(rescheduleReasons)
    .values({ tenantId: t, name: `Reason ${label}` })
    .returning({ id: rescheduleReasons.id });
  const [product] = await testDb
    .insert(products)
    .values({ tenantId: t, name: `Menu ${label}` })
    .returning({ id: products.id });
  await testDb
    .insert(productPriceTiers)
    .values({ tenantId: t, productId: product!.id, numPersons: 10, price: 1000 });
  const [group] = await testDb
    .insert(optionGroups)
    .values({ tenantId: t, productId: product!.id, label: `Group ${label}` })
    .returning({ id: optionGroups.id });
  const [option] = await testDb
    .insert(options)
    .values({ tenantId: t, optionGroupId: group!.id, name: `Option ${label}` })
    .returning({ id: options.id });

  const quoteBase = {
    tenantId: t,
    clientId: client!.id,
    eventTypeId: eventType!.id,
    eventDate: DATE,
    eventTime: TIME,
    taxRate: 0.08,
    depositAmount: 200,
    createdById: tenant.userId,
    assignedToId: tenant.userId,
  };
  const [quote, quote2, freeQuote] = await testDb
    .insert(quotes)
    .values([
      { ...quoteBase, seq: 1, number: 'QUO-000001', stageId: QUOTE_STAGE.CONFIRMED },
      { ...quoteBase, seq: 2, number: 'QUO-000002', stageId: QUOTE_STAGE.CONFIRMED },
      { ...quoteBase, seq: 3, number: 'QUO-000003', stageId: QUOTE_STAGE.PENDING },
    ])
    .returning({ id: quotes.id });
  const [line] = await testDb
    .insert(quoteLines)
    .values({
      tenantId: t,
      quoteId: quote!.id,
      productId: product!.id,
      numPersons: 10,
      subtotal: 1000,
    })
    .returning({ id: quoteLines.id });

  const eventBase = {
    tenantId: t,
    clientId: client!.id,
    eventTypeId: eventType!.id,
    eventDate: DATE,
    eventTime: TIME,
  };
  const [event, event2] = await testDb
    .insert(events)
    .values([
      { ...eventBase, quoteId: quote!.id, totalAmount: 1000 },
      { ...eventBase, quoteId: quote2!.id, totalAmount: 500 },
    ])
    .returning({ id: events.id });
  await testDb.insert(eventStaff).values([
    { tenantId: t, eventId: event!.id, staffId: member!.id },
    { tenantId: t, eventId: event2!.id, staffId: member!.id },
  ]);
  const [payment] = await testDb
    .insert(eventPayments)
    .values({
      tenantId: t,
      eventId: event!.id,
      method: 'cash',
      amount: 300,
      paidAt: '2030-01-15',
    })
    .returning({ id: eventPayments.id });
  const attachmentKey = `t/${t}/event-payments/${label}.png`;
  const [attachment] = await testDb
    .insert(eventPaymentAttachments)
    .values({
      tenantId: t,
      paymentId: payment!.id,
      key: attachmentKey,
      url: `http://r2/${attachmentKey}`,
      fileName: `${label}.png`,
      mimeType: 'image/png',
      size: 10,
    })
    .returning({ id: eventPaymentAttachments.id });
  await testDb
    .insert(eventHistory)
    .values({ tenantId: t, eventId: event!.id, type: 'completed', data: {} });
  await testDb.insert(eventReschedules).values({
    tenantId: t,
    eventId: event!.id,
    fromDate: '2030-05-01',
    toDate: DATE,
    reasonId: reason!.id,
  });
  const [reminder] = await testDb
    .insert(notifications)
    .values({
      tenantId: t,
      type: 'event_selections_reminder',
      data: {},
      entityType: 'event',
      entityId: event!.id,
    })
    .returning({ id: notifications.id });

  return {
    clientId: client!.id,
    eventTypeId: eventType!.id,
    staffId: member!.id,
    freeStaffId: free!.id,
    reasonId: reason!.id,
    productId: product!.id,
    groupId: group!.id,
    optionId: option!.id,
    quoteId: quote!.id,
    lineId: line!.id,
    eventId: event!.id,
    paymentId: payment!.id,
    attachmentId: attachment!.id,
    attachmentKey,
    reminderId: reminder!.id,
    quote2Id: quote2!.id,
    event2Id: event2!.id,
    freeQuoteId: freeQuote!.id,
  };
}

// An event whose own tenant differs from the rows it points at; used to pin join filters.
export async function insertStrayEvent(values: {
  tenantId: string;
  quoteId: string;
  clientId: string;
  eventTypeId?: string;
  totalAmount?: number;
  completedAt?: Date;
}) {
  const [row] = await testDb
    .insert(events)
    .values({ eventDate: DATE, eventTime: TIME, totalAmount: 1000, ...values })
    .returning({ id: events.id });
  return row!.id;
}

export async function insertPayment(tenantId: string, eventId: string, amount: number) {
  const [row] = await testDb
    .insert(eventPayments)
    .values({ tenantId, eventId, method: 'cash', amount, paidAt: '2030-01-20' })
    .returning({ id: eventPayments.id });
  return row!.id;
}
