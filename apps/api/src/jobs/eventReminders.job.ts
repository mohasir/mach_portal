import { db, withTenantTx, type Database, type Tx } from '../db';
import { TenancyRepository } from '../lib/tenancy/tenancy.repository';
import { addDays, subtractDays, todayInBusinessTimezone } from '../lib/utils/date';
import { ConfigRepository } from '../modules/config/config.repository';
import { EventsRepository } from '../modules/events/events.repository';
import { NotificationsRepository } from '../modules/notifications/notifications.repository';
import type { EventSelectionsReminderData } from '../modules/notifications/notifications.resource';

// Days before the selections deadline this starts warning — fixed in code, not an admin
// setting, to keep this reminder's scope small.
const LEAD_DAYS = 3;

export type RemindersRun = { tenantIds: string[]; failed: { tenantId: string; error: unknown }[] };

// Runs as the `app` role, so the tenant's rows are only visible inside its tenant transaction.
export async function checkEventSelectionsReminders(tenantId: string, database: Database = db) {
  await withTenantTx(tenantId, (tx) => createDueReminders(tx, tenantId), database);
}

// One transaction per organization: a failure rolls back only that organization's reminders and
// the run goes on with the rest.
export async function checkEventSelectionsRemindersForAllTenants(
  database: Database = db,
): Promise<RemindersRun> {
  const tenantIds = await new TenancyRepository(database).listOrganizationIds();
  const failed: RemindersRun['failed'] = [];
  for (const tenantId of tenantIds) {
    try {
      await checkEventSelectionsReminders(tenantId, database);
    } catch (error) {
      console.error(`[jobs] event reminders failed for organization ${tenantId}`, error);
      failed.push({ tenantId, error });
    }
  }
  return { tenantIds, failed };
}

async function createDueReminders(tx: Tx, tenantId: string) {
  const eventsRepo = new EventsRepository(tx, tenantId);
  const configRepo = new ConfigRepository(tx, tenantId);
  const notificationsRepo = new NotificationsRepository(tx, tenantId);

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
