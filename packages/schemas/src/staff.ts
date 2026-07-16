import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { optionalEmail, optionalText } from './fields';

export const staffListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'isActive', 'createdAt']).default('createdAt'),
});
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;

export const staffAvailabilityQuerySchema = z.object({
  date: z.iso.date(),
});
export type StaffAvailabilityQuery = z.infer<typeof staffAvailabilityQuerySchema>;

const staffMutationFields = {
  name: z.string().trim().min(1, 'staff.validation.nameRequired').max(120),
  email: optionalEmail('staff.validation.emailInvalid'),
  phone: optionalText(40),
} as const;

export const createStaffSchema = z.object({
  ...staffMutationFields,
  isActive: z.boolean().default(true),
});

export const updateStaffSchema = z.object({
  ...staffMutationFields,
  isActive: z.boolean(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
