import { z } from 'zod';
import { notificationsListQuerySchema } from '@repo/schemas';
import { router, protectedProcedure } from '../../core/trpc/trpc';
import { notificationsModule } from './notifications.module';

export const notificationsRouter = router({
  list: protectedProcedure
    .input(notificationsListQuerySchema)
    .query(({ input, ctx }) => notificationsModule(ctx).list(ctx.user.id, ctx.access, input)),
  unreadCount: protectedProcedure.query(({ ctx }) =>
    notificationsModule(ctx).unreadCount(ctx.user.id, ctx.access),
  ),
  markRead: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => notificationsModule(ctx).markRead(input.id, ctx.user.id)),
  markAllRead: protectedProcedure.mutation(({ ctx }) =>
    notificationsModule(ctx).markAllRead(ctx.user.id, ctx.access),
  ),
  dismiss: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => notificationsModule(ctx).dismiss(input.id, ctx.user.id)),
});
