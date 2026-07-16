import type { Event } from './types';

export const EVENT_STATUS_COLORS: Record<Event['status'], string> = {
  upcoming: 'blue',
  completed: 'green',
  cancelled: 'red',
};
