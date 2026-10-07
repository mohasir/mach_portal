import { rescheduleReasons } from '../../db/schema';

export const publicRescheduleReasonColumns = {
  id: rescheduleReasons.id,
  name: rescheduleReasons.name,
  requiresNote: rescheduleReasons.requiresNote,
  isActive: rescheduleReasons.isActive,
  sortOrder: rescheduleReasons.sortOrder,
} as const;

export type PublicRescheduleReason = Pick<
  typeof rescheduleReasons.$inferSelect,
  keyof typeof publicRescheduleReasonColumns
>;

export const rescheduleReasonResource = (row: PublicRescheduleReason) => ({
  id: row.id,
  name: row.name,
  requiresNote: row.requiresNote,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
});

export const rescheduleReasonCollectionResource = (rows: PublicRescheduleReason[]) =>
  rows.map(rescheduleReasonResource);

export type RescheduleReasonResource = ReturnType<typeof rescheduleReasonResource>;
