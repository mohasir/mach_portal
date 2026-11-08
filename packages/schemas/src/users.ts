import { z } from 'zod';
import { listQuerySchema } from './pagination';

export const usersListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'email', 'role', 'createdAt']).default('createdAt'),
});
export type UsersListQuery = z.infer<typeof usersListQuerySchema>;

export const createUserSchema = z.object({
  name: z.string().min(1, 'users.validation.nameRequired').max(120),
  email: z.email('users.validation.emailInvalid'),
  roleId: z.string().min(1),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'users.validation.nameRequired').max(120),
  roleId: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
