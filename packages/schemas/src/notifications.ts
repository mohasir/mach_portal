import { z } from 'zod';
import { listQuerySchema } from './pagination';

export const notificationsListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['createdAt']).default('createdAt'),
  unreadOnly: z.boolean().optional(),
  cursor: z.number().int().min(0).optional(),
});
export type NotificationsListQuery = z.infer<typeof notificationsListQuerySchema>;
