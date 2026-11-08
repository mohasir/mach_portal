import { TRPCError } from '@trpc/server';
import { scopeFor, type AccessGrants } from '@repo/guards';
import type { NotificationsListQuery } from '@repo/schemas';
import { paginationMeta } from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { NotificationsRepository } from './notifications.repository';
import {
  NOTIFICATION_TYPE_PERMISSION,
  notificationCollectionResource,
  type NotificationType,
} from './notifications.resource';

// The feed is tenant-wide (quote numbers, client names of any record), so an 'own' grant is not
// enough: it would show records the role cannot otherwise read.
function visibleTypes(access: AccessGrants): NotificationType[] {
  return (Object.keys(NOTIFICATION_TYPE_PERMISSION) as NotificationType[]).filter((type) => {
    const { resource, action } = NOTIFICATION_TYPE_PERMISSION[type];
    return scopeFor(access, resource, action) === 'all';
  });
}

function notFound() {
  return new TRPCError({
    code: 'NOT_FOUND',
    cause: new AppError(ErrorCodes.notification.NOT_FOUND),
  });
}

export class NotificationsService {
  constructor(private repo: NotificationsRepository) {}

  async list(userId: string, access: AccessGrants, query: NotificationsListQuery) {
    const { items, total, paginate, page, pageSize, offset, limit } = await this.repo.findPaginated(
      userId,
      visibleTypes(access),
      query,
    );
    const resource = notificationCollectionResource(items);
    // A full page means there's likely more — the infinite-scroll feed uses this as its cursor.
    const nextCursor = items.length === limit ? offset + items.length : undefined;
    if (!paginate) return { items: resource, nextCursor };
    return { items: resource, pagination: paginationMeta(total, page, pageSize), nextCursor };
  }

  async unreadCount(userId: string, access: AccessGrants) {
    return this.repo.countUnreadForUser(userId, visibleTypes(access));
  }

  async markRead(id: string, userId: string) {
    if (!(await this.repo.markRead(id, userId))) throw notFound();
    return { ok: true };
  }

  async dismiss(id: string, userId: string) {
    if (!(await this.repo.dismiss(id, userId))) throw notFound();
    return { ok: true };
  }

  async markAllRead(userId: string, access: AccessGrants) {
    await this.repo.markAllRead(userId, visibleTypes(access));
    return { ok: true };
  }
}
