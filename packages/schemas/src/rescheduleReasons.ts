import { z } from 'zod';
import { listQuerySchema } from './pagination';

export const rescheduleReasonsListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'isActive', 'sortOrder']).default('sortOrder'),
  isActive: z.boolean().optional(),
});
export type RescheduleReasonsListQuery = z.infer<typeof rescheduleReasonsListQuerySchema>;

const rescheduleReasonMutationFields = {
  name: z.string().trim().min(1, 'rescheduleReasons.validation.nameRequired').max(120),
  requiresNote: z.boolean().default(false),
} as const;

export const createRescheduleReasonSchema = z.object(rescheduleReasonMutationFields);
export const updateRescheduleReasonSchema = z.object(rescheduleReasonMutationFields);

export type CreateRescheduleReasonInput = z.infer<typeof createRescheduleReasonSchema>;
export type UpdateRescheduleReasonInput = z.infer<typeof updateRescheduleReasonSchema>;

export const rescheduleReasonToggleActiveSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});
export type RescheduleReasonToggleActiveInput = z.infer<typeof rescheduleReasonToggleActiveSchema>;
