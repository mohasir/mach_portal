import { registerEventRemindersCron } from './eventReminders.cron';

export function registerCrons() {
  registerEventRemindersCron();
}
