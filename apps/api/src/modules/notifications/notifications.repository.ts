import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm';
import type { NotificationsListQuery } from '@repo/schemas';
import type { Database } from '../../db';
import { notifications, notificationReads } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
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
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  // Visible to the caller's role (visibleTypes, resolved by the service from
  // NOTIFICATION_TYPE_ROLES), not the notification's own excluded actor, and not dismissed by
  // this user (a per-user soft delete — see notificationReads.dismissedAt). Every call site
  // already joins notificationReads via readJoin(), so this reference is always safe.
  private audienceWhere(userId: string, visibleTypes: NotificationType[]) {
    return and(
      tenantEq(notifications, this.tenantId),
      inArray(notifications.type, visibleTypes),
      or(isNull(notifications.excludedUserId), ne(notifications.excludedUserId, userId)),
      isNull(notificationReads.dismissedAt),
    );
  }

  // Reads are per tenant too: a read row of another tenant never marks this feed as read.
  private readJoin(userId: string) {
    return and(
      eq(notificationReads.notificationId, notifications.id),
      eq(notificationReads.userId, userId),
      tenantEq(notificationReads, this.tenantId),
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

  async findPaginated(
    userId: string,
    visibleTypes: NotificationType[],
    query: NotificationsListQuery,
  ) {
    const { limit, offset: pageOffset, paginate, page, pageSize } = resolvePagination(query);
    // The infinite-scroll feed drives its own offset (cursor) instead of a page number.
    const offset = query.cursor ?? pageOffset;
    if (visibleTypes.length === 0)
      return { items: [], total: 0, paginate, page, pageSize, offset, limit };

    const where = and(
      this.audienceWhere(userId, visibleTypes),
      query.unreadOnly ? isNull(notificationReads.id) : undefined,
    );
    const orderBy = (query.sortDir === 'asc' ? asc : desc)(notifications.createdAt);

    const items = await this.baseSelect(userId)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
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
      tenantId: this.tenantId,
    });
  }

  // For job-driven types (e.g. reminders): a job may find the same entity "candidate" again
  // on its next run, but the notification for it should only ever be created once.
  async createIfNotExists(input: CreateNotificationInput) {
    const [existing] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.type, input.type),
          eq(notifications.entityId, input.entityId),
          tenantEq(notifications, this.tenantId),
        ),
      )
      .limit(1);
    if (existing) return;
    await this.create(input);
  }

  // The FK check does not see tenants, so the id is resolved inside the tenant first.
  private async exists(notificationId: string) {
    const [row] = await this.db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.id, notificationId), tenantEq(notifications, this.tenantId)))
      .limit(1);
    return row !== undefined;
  }

  async markRead(notificationId: string, userId: string): Promise<boolean> {
    if (!(await this.exists(notificationId))) return false;
    await this.db
      .insert(notificationReads)
      .values({ notificationId, userId, tenantId: this.tenantId })
      .onConflictDoNothing();
    return true;
  }

  async dismiss(notificationId: string, userId: string): Promise<boolean> {
    if (!(await this.exists(notificationId))) return false;
    const dismissedAt = new Date();
    await this.db
      .insert(notificationReads)
      .values({ notificationId, userId, dismissedAt, tenantId: this.tenantId })
      .onConflictDoUpdate({
        target: [notificationReads.notificationId, notificationReads.userId],
        set: { dismissedAt },
      });
    return true;
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
      .values(unread.map((row) => ({ notificationId: row.id, userId, tenantId: this.tenantId })))
      .onConflictDoNothing();
  }
}
