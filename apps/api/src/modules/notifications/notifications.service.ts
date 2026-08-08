import { DEFAULT_ROLE, type RoleType } from '@repo/guards';
import type { NotificationsListQuery } from '@repo/schemas';
import { paginationMeta } from '@repo/schemas';
import type { NotificationsRepository } from './notifications.repository';
import {
  NOTIFICATION_TYPE_ROLES,
  notificationCollectionResource,
  type NotificationType,
} from './notifications.resource';

// Better Auth sessions may carry a comma-separated multi-role string — same split
// hasPermission() does in @repo/guards — so a user matches a type if any of their roles do.
function visibleTypesForRole(role: string | null | undefined): NotificationType[] {
  const userRoles = (role ?? DEFAULT_ROLE).split(',') as RoleType[];
  return (Object.keys(NOTIFICATION_TYPE_ROLES) as NotificationType[]).filter((type) =>
    NOTIFICATION_TYPE_ROLES[type].some((r) => userRoles.includes(r)),
  );
}

export class NotificationsService {
  constructor(private repo: NotificationsRepository) {}

  async list(userId: string, role: string | null | undefined, query: NotificationsListQuery) {
    const { items, total, paginate, page, pageSize, offset, limit } = await this.repo.findPaginated(
      userId,
      visibleTypesForRole(role),
      query,
    );
    const resource = notificationCollectionResource(items);
    // A full page means there's likely more — the infinite-scroll feed uses this as its cursor.
    const nextCursor = items.length === limit ? offset + items.length : undefined;
    if (!paginate) return { items: resource, nextCursor };
    return { items: resource, pagination: paginationMeta(total, page, pageSize), nextCursor };
  }

  async unreadCount(userId: string, role: string | null | undefined) {
    return this.repo.countUnreadForUser(userId, visibleTypesForRole(role));
  }

  async markRead(id: string, userId: string) {
    await this.repo.markRead(id, userId);
    return { ok: true };
  }

  async dismiss(id: string, userId: string) {
    await this.repo.dismiss(id, userId);
    return { ok: true };
  }

  async markAllRead(userId: string, role: string | null | undefined) {
    await this.repo.markAllRead(userId, visibleTypesForRole(role));
    return { ok: true };
  }
}
