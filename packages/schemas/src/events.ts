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

const pad2 = (n: number) => String(n).padStart(2, '0');
/** Today's calendar date (YYYY-MM-DD) where the check runs; ISO dates compare as strings. */
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

export const registerEventPaymentSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().int().positive('events.validation.amountRequired'),
  // A payment records money already received. The API runs on UTC, which is ahead of US clients,
  // so a payment dated "today" on the client never fails the server-side check.
  paidAt: z.iso.date().refine((date) => date <= todayIso(), 'events.validation.paidAtFuture'),
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
