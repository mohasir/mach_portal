import { z } from 'zod';
import { listQuerySchema } from './pagination';

export const eventTypesListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'isActive', 'sortOrder']).default('name'),
});
export type EventTypesListQuery = z.infer<typeof eventTypesListQuerySchema>;

const eventTypeMutationFields = {
  name: z.string().trim().min(1, 'eventTypes.validation.nameRequired').max(120),
} as const;

export const createEventTypeSchema = z.object(eventTypeMutationFields);
export const updateEventTypeSchema = z.object(eventTypeMutationFields);

export type CreateEventTypeInput = z.infer<typeof createEventTypeSchema>;
export type UpdateEventTypeInput = z.infer<typeof updateEventTypeSchema>;

export const eventTypeToggleActiveSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});
export type EventTypeToggleActiveInput = z.infer<typeof eventTypeToggleActiveSchema>;
