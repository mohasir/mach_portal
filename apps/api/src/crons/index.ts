import { registerEventRemindersCron } from './eventReminders.cron';

// Not wired in server.ts: jobs are tenant-scoped and nothing iterates over tenants yet.
export function registerCrons(tenantId: string) {
  registerEventRemindersCron(tenantId);
}
