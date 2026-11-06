import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import { QUOTE_STAGE, type UserPreferences } from '@repo/schemas';
import { db } from '../index';
import {
  clients,
  eventHistory,
  eventPayments,
  eventReschedules,
  events,
  notificationReads,
  notifications,
  quoteStageSettings,
  quotes,
  rescheduleReasons,
  user,
  userPreferences,
} from '../schema';

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SeedStageOverride {
  stageId: number;
  label?: string;
  color?: string;
  description?: string;
}

export async function seedQuoteStageSettings(tenantId: string, overrides: SeedStageOverride[]) {
  console.log('🏷️  Seeding personalización de estados...');
  if (overrides.length === 0) return;
  await db
    .insert(quoteStageSettings)
    .values(overrides.map((o) => ({ ...o, tenantId })))
    .onConflictDoNothing();
}

export interface SeedActivityOptions {
  actorEmail: string;
  // Users that get a read receipt on the first notification and saved preferences.
  readerEmails: string[];
  preferences: Partial<UserPreferences>;
  reschedules: number;
}

// Reschedules (with their history row and notification), payment history, quote notifications,
// read receipts and user preferences. Rescheduled events keep their seeded date as the new date
// and get a "from" date a week earlier.
export async function seedEventActivity(tenantId: string, opts: SeedActivityOptions) {
  console.log('🗓️  Seeding actividad (reprogramaciones, historial, notificaciones)...');

  const [actor] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.email, opts.actorEmail));
  if (!actor) {
    console.log(`  ⏭️  usuario "${opts.actorEmail}" no existe, salteando actividad`);
    return;
  }
  const visual = { source: 'user' as const, actor: { name: actor.name, image: actor.image } };

  const reasons = await db
    .select({ id: rescheduleReasons.id, name: rescheduleReasons.name })
    .from(rescheduleReasons)
    .where(and(eq(rescheduleReasons.tenantId, tenantId), eq(rescheduleReasons.requiresNote, false)))
    .orderBy(asc(rescheduleReasons.sortOrder));

  const eventRows = await db
    .select({
      id: events.id,
      eventDate: events.eventDate,
      eventTime: events.eventTime,
      quoteNumber: quotes.number,
      clientName: clients.name,
    })
    .from(events)
    .innerJoin(quotes, and(eq(quotes.id, events.quoteId), eq(quotes.tenantId, tenantId)))
    .innerJoin(clients, and(eq(clients.id, events.clientId), eq(clients.tenantId, tenantId)))
    .where(and(eq(events.tenantId, tenantId), isNotNull(events.eventDate)))
    .orderBy(asc(quotes.seq));

  for (const [index, event] of eventRows.entries()) {
    const [existing] = await db
      .select({ id: eventHistory.id })
      .from(eventHistory)
      .where(and(eq(eventHistory.tenantId, tenantId), eq(eventHistory.eventId, event.id)))
      .limit(1);
    if (existing) continue;

    const payments = await db
      .select({ id: eventPayments.id, amount: eventPayments.amount, method: eventPayments.method })
      .from(eventPayments)
      .where(and(eq(eventPayments.tenantId, tenantId), eq(eventPayments.eventId, event.id)));
    if (payments.length > 0) {
      await db.insert(eventHistory).values(
        payments.map((p) => ({
          eventId: event.id,
          type: 'payment_registered',
          data: { paymentId: p.id, amount: p.amount, method: p.method },
          changedById: actor.id,
          tenantId,
        })),
      );
    }

    const reason = reasons[index % Math.max(reasons.length, 1)];
    if (index >= opts.reschedules || !reason) continue;

    const from = { date: addDays(event.eventDate!, -7), time: event.eventTime };
    const to = { date: event.eventDate!, time: event.eventTime };
    await db.insert(eventReschedules).values({
      eventId: event.id,
      fromDate: from.date,
      fromTime: from.time,
      toDate: to.date,
      toTime: to.time,
      reasonId: reason.id,
      rescheduledById: actor.id,
      tenantId,
    });
    await db.insert(eventHistory).values({
      eventId: event.id,
      type: 'rescheduled',
      data: { from, to, reasonName: reason.name },
      changedById: actor.id,
      tenantId,
    });
    await createNotificationOnce(tenantId, {
      type: 'event_rescheduled',
      entityType: 'event',
      entityId: event.id,
      data: {
        ...visual,
        quoteNumber: event.quoteNumber,
        clientName: event.clientName,
        fromDate: from.date,
        toDate: to.date,
        toTime: to.time,
      },
    });
    console.log(`  ✅ reprogramación de ${event.quoteNumber} (${reason.name})`);
  }

  const closedQuotes = await db
    .select({ id: quotes.id, number: quotes.number, stageId: quotes.stageId })
    .from(quotes)
    .where(
      and(
        eq(quotes.tenantId, tenantId),
        inArray(quotes.stageId, [QUOTE_STAGE.CONFIRMED, QUOTE_STAGE.CANCELLED]),
      ),
    )
    .orderBy(asc(quotes.seq));
  for (const q of closedQuotes) {
    await createNotificationOnce(tenantId, {
      type: q.stageId === QUOTE_STAGE.CONFIRMED ? 'quote_confirmed' : 'quote_cancelled',
      entityType: 'quote',
      entityId: q.id,
      data: { ...visual, quoteNumber: q.number },
    });
  }

  const [first] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.tenantId, tenantId))
    .orderBy(asc(notifications.createdAt), asc(notifications.id))
    .limit(1);
  const readers =
    opts.readerEmails.length > 0
      ? await db.select({ id: user.id }).from(user).where(inArray(user.email, opts.readerEmails))
      : [];
  if (first && readers.length > 0) {
    await db
      .insert(notificationReads)
      .values(readers.map((r) => ({ notificationId: first.id, userId: r.id, tenantId })))
      .onConflictDoNothing();
  }
  if (readers.length > 0) {
    await db
      .insert(userPreferences)
      .values(readers.map((r) => ({ userId: r.id, preferences: opts.preferences, tenantId })))
      .onConflictDoNothing();
  }
}

async function createNotificationOnce(
  tenantId: string,
  n: { type: string; entityType: string; entityId: string; data: Record<string, unknown> },
) {
  const [existing] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.type, n.type),
        eq(notifications.entityId, n.entityId),
      ),
    )
    .limit(1);
  if (existing) return;
  await db.insert(notifications).values({ ...n, tenantId });
}
