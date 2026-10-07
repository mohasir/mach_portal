import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { paymentMethodSchema } from './enums';
import { optionalText } from './fields';

// "upcoming"/"past" bucket by eventDate vs. today — a separate axis from the derived
// upcoming/completed/cancelled `status` (events.resource.ts), which tracks completion, not time.
export const eventsSegmentSchema = z.enum(['upcoming', 'past', 'all']);
export type EventsSegment = z.infer<typeof eventsSegmentSchema>;

export const eventsListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['eventDate', 'totalAmount', 'createdAt']).default('eventDate'),
  clientId: z.uuid().optional(),
  segment: eventsSegmentSchema.default('upcoming'),
});
export type EventsListQuery = z.infer<typeof eventsListQuerySchema>;

export const eventsCalendarQuerySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
});
export type EventsCalendarQuery = z.infer<typeof eventsCalendarQuerySchema>;

// The latest calendar date anywhere on Earth (UTC+14). This schema runs on both the client and
// the server, which can sit in different zones, so "not in the future" is judged against the date
// no user can be ahead of. The web's date picker still blocks days after the user's own today.
const latestTodayIso = () =>
  new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const registerEventPaymentSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().int().positive('events.validation.amountRequired'),
  // A payment records money already received, so it can't be dated in the future.
  paidAt: z.iso.date().refine((date) => date <= latestTodayIso(), 'events.validation.paidAtFuture'),
  reference: optionalText(120),
  notes: optionalText(500),
});
export type RegisterEventPaymentInput = z.infer<typeof registerEventPaymentSchema>;

export const assignStaffSchema = z.object({
  eventId: z.uuid(),
  staffId: z.uuid(),
  role: optionalText(100),
});
export type AssignStaffInput = z.infer<typeof assignStaffSchema>;

export const removeStaffSchema = z.object({
  eventId: z.uuid(),
  staffId: z.uuid(),
});
export type RemoveStaffInput = z.infer<typeof removeStaffSchema>;

export const removeEventPaymentSchema = z.object({
  eventId: z.uuid(),
  paymentId: z.uuid(),
});
export type RemoveEventPaymentInput = z.infer<typeof removeEventPaymentSchema>;

export const removeEventPaymentAttachmentSchema = z.object({
  eventId: z.uuid(),
  attachmentId: z.uuid(),
});
export type RemoveEventPaymentAttachmentInput = z.infer<typeof removeEventPaymentAttachmentSchema>;

// One entry per (quoteLine, optionGroup) being resolved — mirrors quoteLineSelectionSchema
// (quotes.ts) but scoped to a specific line rather than a whole new line.
export const eventLineSelectionSchema = z.object({
  quoteLineId: z.uuid(),
  optionGroupId: z.uuid(),
  optionIds: z.array(z.uuid()),
});
export type EventLineSelectionInput = z.infer<typeof eventLineSelectionSchema>;

export const updateEventSelectionsSchema = z.object({
  eventId: z.uuid(),
  selections: z.array(eventLineSelectionSchema),
});
export type UpdateEventSelectionsInput = z.infer<typeof updateEventSelectionsSchema>;

// `eventTime` is free text: pickers save "HH:mm", but older rows may hold "9:00". Comparing two
// times goes through this so "9:00" and "09:00" count as the same; anything else stays as is.
export const normalizeEventTime = (time: string | null | undefined): string | null => {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  return match ? `${match[1]!.padStart(2, '0')}:${match[2]}` : time;
};

export const checkRescheduleSchema = z.object({
  eventId: z.uuid(),
  eventDate: z.iso.date(),
  eventTime: optionalText(20),
});
export type CheckRescheduleQuery = z.infer<typeof checkRescheduleSchema>;

export const rescheduleEventSchema = checkRescheduleSchema.extend({
  reasonId: z.uuid(),
  note: optionalText(500),
});
export type RescheduleEventInput = z.infer<typeof rescheduleEventSchema>;
