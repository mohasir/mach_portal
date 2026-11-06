import { and, eq } from 'drizzle-orm';
import { paymentMethodSchema } from '@repo/schemas';
import { db } from '../index';
import { events, eventPaymentAttachments, eventPayments, quotes, user } from '../schema';

const METHODS = paymentMethodSchema.options;

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Deposit ~45 days before the event (matches the real registration flow — clients pay the
// deposit well ahead of the date). Balance only gets seeded for events whose date has already
// passed "today", the same way a real client would only have paid the balance by then.
// Every deposit gets one attachment row with metadata only: the referenced object does not exist.
export async function seedEventPayments(tenantId: string, creatorEmail: string) {
  console.log('💵 Seeding pagos de eventos...');

  const [creator] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, creatorEmail))
    .limit(1);
  if (!creator) {
    console.log(`  ⏭️  usuario "${creatorEmail}" no existe, salteando pagos`);
    return;
  }

  const rows = await db
    .select({
      eventId: events.id,
      eventDate: events.eventDate,
      totalAmount: events.totalAmount,
      depositAmount: quotes.depositAmount,
      quoteNumber: quotes.number,
    })
    .from(events)
    .innerJoin(quotes, and(eq(events.quoteId, quotes.id), eq(quotes.tenantId, tenantId)))
    .where(eq(events.tenantId, tenantId))
    .orderBy(quotes.seq);

  const today = new Date().toISOString().slice(0, 10);
  let methodIndex = 0;
  const nextMethod = () => METHODS[methodIndex++ % METHODS.length]!;

  for (const row of rows) {
    if (!row.eventDate) continue;

    const [existing] = await db
      .select({ id: eventPayments.id })
      .from(eventPayments)
      .where(and(eq(eventPayments.tenantId, tenantId), eq(eventPayments.eventId, row.eventId)))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  evento ${row.eventId} ya tiene pagos, salteando`);
      continue;
    }

    const isPast = row.eventDate < today;
    const balance = row.totalAmount - row.depositAmount;

    const paymentRows: (typeof eventPayments.$inferInsert)[] = [
      {
        eventId: row.eventId,
        method: nextMethod(),
        amount: row.depositAmount,
        paidAt: addDays(row.eventDate, -45),
        createdById: creator.id,
        tenantId,
      },
    ];
    if (isPast && balance > 0) {
      paymentRows.push({
        eventId: row.eventId,
        method: nextMethod(),
        amount: balance,
        paidAt: addDays(row.eventDate, -1),
        createdById: creator.id,
        tenantId,
      });
    }

    const inserted = await db
      .insert(eventPayments)
      .values(paymentRows)
      .returning({ id: eventPayments.id });
    const depositId = inserted[0]!.id;
    const fileName = `comprobante-${row.quoteNumber}.pdf`;
    const key = `t/${tenantId}/event-payments/${depositId}/${fileName}`;
    await db.insert(eventPaymentAttachments).values({
      paymentId: depositId,
      key,
      url: `https://demo.invalid/${key}`,
      fileName,
      mimeType: 'application/pdf',
      size: 48_213,
      createdById: creator.id,
      tenantId,
    });
    await db
      .update(events)
      .set({ depositPaid: true, balancePaid: isPast && balance > 0 })
      .where(and(eq(events.tenantId, tenantId), eq(events.id, row.eventId)));

    console.log(
      `  ✅ evento ${row.eventId} — ${paymentRows.length} pago(s) (${isPast ? 'saldado' : 'depósito'})`,
    );
  }
}
