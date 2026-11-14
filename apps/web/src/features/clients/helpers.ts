import type { ClientStatus } from '@repo/schemas';

export const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  lead: 'default',
  active: 'green',
};

export type ClientDetailTabKey = 'quotes' | 'events';

export function visibleClientTabs(active: { quotes: boolean; events: boolean }) {
  const keys: ClientDetailTabKey[] = [];
  if (active.quotes) keys.push('quotes');
  if (active.events) keys.push('events');
  return keys;
}
