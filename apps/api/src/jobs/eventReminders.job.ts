import { db } from '../db';
import { addDays, subtractDays, todayInBusinessTimezone } from '../lib/utils/date';
import { ConfigRepository } from '../modules/config/config.repository';
import { EventsRepository } from '../modules/events/events.repository';
import { NotificationsRepository } from '../modules/notifications/notifications.repository';
import type { EventSelectionsReminderData } from '../modules/notifications/notifications.resource';

// Days before the selections deadline this starts warning — fixed in code, not an admin
// setting, to keep this reminder's scope small.
const LEAD_DAYS = 3;

const eventsRepo = new EventsRepository(db);
const configRepo = new ConfigRepository(db);
const notificationsRepo = new NotificationsRepository(db);

export async function checkEventSelectionsReminders() {
  const [rawCandidates, appRow] = await Promise.all([
    eventsRepo.findPendingSelectionsCandidates(),
    configRepo.findAppSettings(),
  ]);
  const deadlineDays = appRow?.optionsSelectionDeadlineDays ?? 0;
  const today = todayInBusinessTimezone();
  const windowEnd = addDays(today, LEAD_DAYS);

  const due = rawCandidates
    .filter((event) => !!event.eventDate) // SQL already filters this; narrows the nullable column type
    .filter((event) => event.eventDate! >= today) // already happened — "complete before the event"
    // doesn't mean anything anymore, whether or not someone remembered to mark it completed
    .map((event) => ({
      ...event,
      eventDate: event.eventDate!,
      deadline: subtractDays(event.eventDate!, deadlineDays),
    }))
    .filter((event) => event.deadline <= windowEnd) // deadline still far away — not due yet
    // The feed sorts newest-first (createdAt DESC) everywhere else in the app — creating the
    // soonest event's reminder LAST gives it the latest createdAt, so it lands at the top.
    .sort((a, b) => (a.eventDate < b.eventDate ? 1 : a.eventDate > b.eventDate ? -1 : 0));

  for (const event of due) {
    const data: EventSelectionsReminderData = {
      source: 'system',
      icon: 'calendar-clock',
      clientName: event.clientName,
      eventDate: event.eventDate,
      quoteNumber: event.quoteNumber,
      deadline: event.deadline,
    };
    await notificationsRepo.createIfNotExists({
      type: 'event_selections_reminder',
      data,
      entityType: 'event',
      entityId: event.id,
    });
  }
}
