import { eventTypes } from '../../db/schema';

export const publicEventTypeColumns = {
  id: eventTypes.id,
  name: eventTypes.name,
  color: eventTypes.color,
  isActive: eventTypes.isActive,
  sortOrder: eventTypes.sortOrder,
} as const;

export type PublicEventType = Pick<
  typeof eventTypes.$inferSelect,
  keyof typeof publicEventTypeColumns
>;

export const eventTypeResource = (row: PublicEventType) => ({
  id: row.id,
  name: row.name,
  color: row.color,
  sortOrder: row.sortOrder,
});

export const eventTypeCollectionResource = (rows: PublicEventType[]) => rows.map(eventTypeResource);

export type EventTypeResource = ReturnType<typeof eventTypeResource>;
