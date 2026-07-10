import { z } from 'zod';

const roleEnum = z.enum(['superadmin', 'admin', 'member']);

export const createUserSchema = z.object({
  name: z.string().min(1, 'users.validation.nameRequired').max(120),
  email: z.email('users.validation.emailInvalid'),
  password: z.string().min(8, 'users.validation.passwordMin').max(128),
  role: roleEnum,
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'users.validation.nameRequired').max(120),
  role: roleEnum,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserRole = z.infer<typeof roleEnum>;
