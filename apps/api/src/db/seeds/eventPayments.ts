import { eq } from 'drizzle-orm';
import { paymentMethodSchema } from '@repo/schemas';
import { db } from '../index';
import { events, eventPayments, quotes, user } from '../schema';

const SEED_CREATOR_EMAIL = 'samuel@admin.com';
const METHODS = paymentMethodSchema.options;

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Deposit ~45 days before the event (matches the real registration flow — clients pay the
// deposit well ahead of the date). Balance only gets seeded for events whose date has already
// passed "today", the same way a real client would only have paid the balance by then.
export async function seedEventPayments() {
  console.log('💵 Seeding pagos de eventos...');

  const [creator] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, SEED_CREATOR_EMAIL))
    .limit(1);
  if (!creator) {
    console.log(`  ⏭️  usuario "${SEED_CREATOR_EMAIL}" no existe, salteando pagos`);
    return;
  }

  const rows = await db
    .select({
      eventId: events.id,
      eventDate: events.eventDate,
      totalAmount: events.totalAmount,
      depositAmount: quotes.depositAmount,
    })
    .from(events)
    .innerJoin(quotes, eq(events.quoteId, quotes.id));

  const today = new Date().toISOString().slice(0, 10);
  let methodIndex = 0;
  const nextMethod = () => METHODS[methodIndex++ % METHODS.length]!;

  for (const row of rows) {
    if (!row.eventDate) continue;

    const [existing] = await db
      .select({ id: eventPayments.id })
      .from(eventPayments)
      .where(eq(eventPayments.eventId, row.eventId))
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
      },
    ];
    if (isPast && balance > 0) {
      paymentRows.push({
        eventId: row.eventId,
        method: nextMethod(),
        amount: balance,
        paidAt: addDays(row.eventDate, -1),
        createdById: creator.id,
      });
    }

    await db.insert(eventPayments).values(paymentRows);
    await db
      .update(events)
      .set({ depositPaid: true, balancePaid: isPast && balance > 0 })
      .where(eq(events.id, row.eventId));

    console.log(
      `  ✅ evento ${row.eventId} — ${paymentRows.length} pago(s) (${isPast ? 'saldado' : 'depósito'})`,
    );
  }
}
