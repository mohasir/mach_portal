import { eq } from 'drizzle-orm';
import { QUOTE_STAGE } from '@repo/schemas';
import { db } from '../index';
import { quotes, events, eventStaff, staff } from '../schema';

export async function seedEvents() {
  console.log('📅 Seeding eventos...');

  const confirmedQuotes = await db
    .select({
      id: quotes.id,
      number: quotes.number,
      clientId: quotes.clientId,
      eventTypeId: quotes.eventTypeId,
      eventDate: quotes.eventDate,
      eventTime: quotes.eventTime,
      state: quotes.state,
      address: quotes.address,
      total: quotes.total,
    })
    .from(quotes)
    .where(eq(quotes.stageId, QUOTE_STAGE.CONFIRMED));

  const activeStaff = await db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .where(eq(staff.isActive, true));

  if (activeStaff.length === 0) {
    console.log('  ⏭️  no hay staff activo, salteando asignaciones');
  }

  for (const [index, quote] of confirmedQuotes.entries()) {
    const [existing] = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.quoteId, quote.id))
      .limit(1);
    if (existing) {
      console.log(`  ⏭️  evento de ${quote.number} ya existe, salteando`);
      continue;
    }

    const [event] = await db
      .insert(events)
      .values({
        quoteId: quote.id,
        clientId: quote.clientId,
        eventTypeId: quote.eventTypeId,
        eventDate: quote.eventDate,
        eventTime: quote.eventTime,
        state: quote.state,
        address: quote.address,
        totalAmount: quote.total,
      })
      .returning({ id: events.id });

    if (activeStaff.length > 0) {
      // Round-robin over the active pool, 2 per event (deduped if the pool is smaller than that).
      const picks = [
        activeStaff[index % activeStaff.length]!,
        activeStaff[(index + 1) % activeStaff.length]!,
      ];
      const assigned = [...new Map(picks.map((s) => [s.id, s])).values()];
      await db
        .insert(eventStaff)
        .values(assigned.map((s) => ({ eventId: event!.id, staffId: s.id })));
      console.log(
        `  ✅ evento para ${quote.number} — staff: ${assigned.map((s) => s.name).join(', ')}`,
      );
    } else {
      console.log(`  ✅ evento para ${quote.number} (sin staff asignado)`);
    }
  }
}
