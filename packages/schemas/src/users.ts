import { z } from 'zod';
import { listQuerySchema } from './pagination';

const roleEnum = z.enum(['superadmin', 'admin', 'operator', 'member']);

export const usersListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'email', 'role', 'createdAt']).default('createdAt'),
});
export type UsersListQuery = z.infer<typeof usersListQuerySchema>;

export const createUserSchema = z.object({
  name: z.string().min(1, 'users.validation.nameRequired').max(120),
  email: z.email('users.validation.emailInvalid'),
  role: roleEnum,
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'users.validation.nameRequired').max(120),
  role: roleEnum,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserRole = z.infer<typeof roleEnum>;
