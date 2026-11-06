import cron from 'node-cron';
import { checkEventSelectionsReminders } from '../jobs/eventReminders.job';

// 12:00 UTC ≈ 7-8am America/New_York (the business's timezone) — once a day.
export function registerEventRemindersCron(tenantId: string) {
  cron.schedule('0 12 * * *', () => {
    checkEventSelectionsReminders(tenantId).catch((err) =>
      console.error('[cron] eventReminders', err),
    );
  });
}
