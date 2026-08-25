import { z } from 'zod';
import { notificationsListQuerySchema } from '@repo/schemas';
import { router, protectedProcedure } from '../../core/trpc/trpc';
import { db } from '../../db';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

const service = new NotificationsService(new NotificationsRepository(db));

const roleOf = (ctx: { user: { role?: string | null } }) => ctx.user.role;

export const notificationsRouter = router({
  list: protectedProcedure
    .input(notificationsListQuerySchema)
    .query(({ input, ctx }) => service.list(ctx.user.id, roleOf(ctx), input)),
  unreadCount: protectedProcedure.query(({ ctx }) => service.unreadCount(ctx.user.id, roleOf(ctx))),
  markRead: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => service.markRead(input.id, ctx.user.id)),
  markAllRead: protectedProcedure.mutation(({ ctx }) =>
    service.markAllRead(ctx.user.id, roleOf(ctx)),
  ),
  dismiss: protectedProcedure
    .input(z.object({ id: z.uuid() }))
    .mutation(({ input, ctx }) => service.dismiss(input.id, ctx.user.id)),
});
