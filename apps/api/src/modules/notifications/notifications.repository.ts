import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { NotificationsListQuery } from '@repo/schemas';
import type { Database } from '../../db';
import { notifications, notificationReads } from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';
import type { NotificationType } from './notifications.resource';

export type CreateNotificationInput = {
  type: NotificationType;
  data: unknown;
  entityType: string;
  entityId: string;
  excludedUserId?: string | null;
};

export class NotificationsRepository {
  constructor(private db: Database) {}

  // Visible to the caller's role (visibleTypes, resolved by the service from
  // NOTIFICATION_TYPE_ROLES), not the notification's own excluded actor, and not dismissed by
  // this user (a per-user soft delete — see notificationReads.dismissedAt). Every call site
  // already joins notificationReads via readJoin(), so this reference is always safe.
  private audienceWhere(userId: string, visibleTypes: NotificationType[]) {
    return and(
      inArray(notifications.type, visibleTypes),
      or(isNull(notifications.excludedUserId), ne(notifications.excludedUserId, userId)),
      isNull(notificationReads.dismissedAt),
    );
  }

  private readJoin(userId: string) {
    return and(
      eq(notificationReads.notificationId, notifications.id),
      eq(notificationReads.userId, userId),
    );
  }

  private baseSelect(userId: string) {
    return this.db
      .select({
        id: notifications.id,
        type: notifications.type,
        data: notifications.data,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        excludedUserId: notifications.excludedUserId,
        createdAt: notifications.createdAt,
        read: sql<boolean>`${notificationReads.id} is not null`,
      })
      .from(notifications)
      .leftJoin(notificationReads, this.readJoin(userId));
  }

  async findPaginated(userId: string, visibleTypes: NotificationType[], query: NotificationsListQuery) {
    const { limit, offset: pageOffset, paginate, page, pageSize } = resolvePagination(query);
    // The infinite-scroll feed drives its own offset (cursor) instead of a page number.
    const offset = query.cursor ?? pageOffset;
    if (visibleTypes.length === 0) return { items: [], total: 0, paginate, page, pageSize, offset, limit };

    const where = and(
      this.audienceWhere(userId, visibleTypes),
      query.unreadOnly ? isNull(notificationReads.id) : undefined,
    );
    const orderBy = (query.sortDir === 'asc' ? asc : desc)(notifications.createdAt);

    const items = await this.baseSelect(userId).where(where).orderBy(orderBy).limit(limit).offset(offset);
    const total = paginate ? await this.countAll(userId, where) : items.length;
    return { items, total, paginate, page, pageSize, offset, limit };
  }

  // Joins notificationReads too — `where` may reference it (unreadOnly filter above).
  private async countAll(userId: string, where: SQL | undefined) {
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .leftJoin(notificationReads, this.readJoin(userId))
      .where(where);
    return row?.value ?? 0;
  }

  async countUnreadForUser(userId: string, visibleTypes: NotificationType[]) {
    if (visibleTypes.length === 0) return 0;
    const [row] = await this.db
      .select({ value: count() })
      .from(notifications)
      .leftJoin(notificationReads, this.readJoin(userId))
      .where(and(this.audienceWhere(userId, visibleTypes), isNull(notificationReads.id)));
    return row?.value ?? 0;
  }

  async create(input: CreateNotificationInput) {
    await this.db.insert(notifications).values({
      type: input.type,
      data: input.data,
      entityType: input.entityType,
      entityId: input.entityId,
      excludedUserId: input.excludedUserId ?? null,
    });
  }

  async markRead(notificationId: string, userId: string) {
    await this.db.insert(notificationReads).values({ notificationId, userId }).onConflictDoNothing();
  }

  async dismiss(notificationId: string, userId: string) {
    const dismissedAt = new Date();
    await this.db
      .insert(notificationReads)
      .values({ notificationId, userId, dismissedAt })
      .onConflictDoUpdate({
        target: [notificationReads.notificationId, notificationReads.userId],
        set: { dismissedAt },
      });
  }

  async markAllRead(userId: string, visibleTypes: NotificationType[]) {
    if (visibleTypes.length === 0) return;
    const unread = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .leftJoin(notificationReads, this.readJoin(userId))
      .where(and(this.audienceWhere(userId, visibleTypes), isNull(notificationReads.id)));
    if (unread.length === 0) return;

    await this.db
      .insert(notificationReads)
      .values(unread.map((row) => ({ notificationId: row.id, userId })))
      .onConflictDoNothing();
  }
}
