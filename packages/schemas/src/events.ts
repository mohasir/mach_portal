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

export const registerEventPaymentSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().int().positive('events.validation.amountRequired'),
  paidAt: z.iso.date(),
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

export const removeEventPaymentAttachmentSchema = z.object({
  eventId: z.uuid(),
  attachmentId: z.uuid(),
});
export type RemoveEventPaymentAttachmentInput = z.infer<typeof removeEventPaymentAttachmentSchema>;
