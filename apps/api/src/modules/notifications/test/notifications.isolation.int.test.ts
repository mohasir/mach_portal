import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { notificationsListQuerySchema } from '@repo/schemas';
import { notificationReads, notifications } from '../../../db/schema';
import {
  addMember,
  addMemberWithGrants,
  createTestUser,
  resetDb,
  seedTwoTenants,
  testDb,
  type TestTenant,
} from '../../../test/db';
import { NotificationsRepository } from '../notifications.repository';
import type { NotificationType } from '../notifications.resource';
import { NotificationsService } from '../notifications.service';
import { callerFor } from '../../../test/trpcCaller';

const TYPES: NotificationType[] = [
  'quote_confirmed',
  'quote_cancelled',
  'event_selections_reminder',
  'event_rescheduled',
];
const page = (extra: Record<string, unknown> = {}) =>
  notificationsListQuerySchema.parse({ page: 1, pageSize: 50, ...extra });

type Seeded = { confirmedId: string; cancelledId: string; excludedId: string };

async function seedTenant(tenantId: string, excludedUserId: string): Promise<Seeded> {
  const [confirmed, cancelled, excluded] = await testDb
    .insert(notifications)
    .values([
      { tenantId, type: 'quote_confirmed', data: {}, entityType: 'quote', entityId: randomUUID() },
      { tenantId, type: 'quote_cancelled', data: {}, entityType: 'quote', entityId: randomUUID() },
      {
        tenantId,
        type: 'event_rescheduled',
        data: {},
        entityType: 'event',
        entityId: randomUUID(),
        excludedUserId,
      },
    ])
    .returning({ id: notifications.id });
  return { confirmedId: confirmed!.id, cancelledId: cancelled!.id, excludedId: excluded!.id };
}

const readsOf = (tenantId: string) =>
  testDb.select().from(notificationReads).where(eq(notificationReads.tenantId, tenantId));

describe('notifications tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  // The same global user, member of both tenants.
  let userId: string;
  let na: Seeded;
  let nb: Seeded;
  let repoA: NotificationsRepository;
  let repoB: NotificationsRepository;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    userId = (await createTestUser({ role: 'admin' })).id;
    await addMember(userId, a.id);
    await addMember(userId, b.id);
    na = await seedTenant(a.id, userId);
    nb = await seedTenant(b.id, userId);
    // In B the user already read one notification.
    await testDb
      .insert(notificationReads)
      .values({ tenantId: b.id, notificationId: nb.confirmedId, userId });
    repoA = new NotificationsRepository(testDb, a.id);
    repoB = new NotificationsRepository(testDb, b.id);
  });

  it('findPaginated lists only the tenant feed, with its own read state', async () => {
    const resA = await repoA.findPaginated(userId, TYPES, page());
    expect(resA.items.map((n) => n.id).sort()).toEqual([na.confirmedId, na.cancelledId].sort());
    expect(resA.total).toBe(2);
    expect(resA.items.every((n) => !n.read)).toBe(true);
    const resB = await repoB.findPaginated(userId, TYPES, page());
    expect(resB.items.find((n) => n.id === nb.confirmedId)?.read).toBe(true);
  });

  it('unreadOnly and countUnreadForUser count per tenant', async () => {
    const unreadA = await repoA.findPaginated(userId, TYPES, page({ unreadOnly: true }));
    expect(unreadA.total).toBe(2);
    expect(await repoA.countUnreadForUser(userId, TYPES)).toBe(2);
    expect(await repoB.countUnreadForUser(userId, TYPES)).toBe(1);
  });

  it('excludedUserId still hides the actor own notification', async () => {
    const other = (await createTestUser()).id;
    const res = await repoA.findPaginated(other, TYPES, page());
    expect(res.items.map((n) => n.id)).toContain(na.excludedId);
    const own = await repoA.findPaginated(userId, TYPES, page());
    expect(own.items.map((n) => n.id)).not.toContain(na.excludedId);
  });

  it('a B read or dismissal on an A notification does not count for A', async () => {
    await testDb.insert(notificationReads).values([
      { tenantId: b.id, notificationId: na.confirmedId, userId },
      { tenantId: b.id, notificationId: na.cancelledId, userId, dismissedAt: new Date() },
    ]);
    const res = await repoA.findPaginated(userId, TYPES, page());
    expect(res.items.map((n) => n.id).sort()).toEqual([na.confirmedId, na.cancelledId].sort());
    expect(res.items.every((n) => !n.read)).toBe(true);
    expect((await repoA.findPaginated(userId, TYPES, page({ unreadOnly: true }))).total).toBe(2);
    expect(await repoA.countUnreadForUser(userId, TYPES)).toBe(2);
  });

  it('markRead and dismiss reject another tenant notification and write nothing', async () => {
    expect(await repoA.markRead(nb.cancelledId, userId)).toBe(false);
    expect(await repoA.dismiss(nb.cancelledId, userId)).toBe(false);
    expect(await repoA.markRead(randomUUID(), userId)).toBe(false);
    expect(await readsOf(a.id)).toHaveLength(0);
    expect(await readsOf(b.id)).toHaveLength(1);
    expect(await repoB.countUnreadForUser(userId, TYPES)).toBe(1);
  });

  it('markRead and dismiss stamp the tenant on own notifications', async () => {
    expect(await repoA.markRead(na.confirmedId, userId)).toBe(true);
    expect(await repoA.dismiss(na.cancelledId, userId)).toBe(true);
    const rows = await readsOf(a.id);
    expect(rows.map((r) => r.notificationId).sort()).toEqual(
      [na.confirmedId, na.cancelledId].sort(),
    );
    expect(await repoA.countUnreadForUser(userId, TYPES)).toBe(0);
  });

  it('markAllRead only touches the tenant feed and stamps the tenant', async () => {
    await repoA.markAllRead(userId, TYPES);
    const rows = await readsOf(a.id);
    expect(rows.map((r) => r.notificationId).sort()).toEqual(
      [na.confirmedId, na.cancelledId].sort(),
    );
    expect(await repoB.countUnreadForUser(userId, TYPES)).toBe(1);
  });

  it('create and createIfNotExists stamp the tenant; B rows do not block A', async () => {
    await repoA.create({
      type: 'quote_confirmed',
      data: {},
      entityType: 'quote',
      entityId: randomUUID(),
    });
    const [existingB] = await testDb
      .select()
      .from(notifications)
      .where(eq(notifications.id, nb.confirmedId));
    await repoA.createIfNotExists({
      type: 'quote_confirmed',
      data: {},
      entityType: 'quote',
      entityId: existingB!.entityId,
    });
    await repoA.createIfNotExists({
      type: 'quote_confirmed',
      data: {},
      entityType: 'quote',
      entityId: existingB!.entityId,
    });
    const rowsA = await testDb.select().from(notifications).where(eq(notifications.tenantId, a.id));
    expect(rowsA).toHaveLength(5);
    const rowsB = await testDb.select().from(notifications).where(eq(notifications.tenantId, b.id));
    expect(rowsB).toHaveLength(3);
  });

  it('the service answers NOT_FOUND for another tenant notification', async () => {
    const service = new NotificationsService(repoA);
    await expect(service.markRead(nb.confirmedId, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'NOTIFICATION_NOT_FOUND' },
    });
    await expect(service.dismiss(nb.confirmedId, userId)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'NOTIFICATION_NOT_FOUND' },
    });
    expect(await service.markRead(na.confirmedId, userId)).toEqual({ ok: true });
  });

  describe('audience follows the membership role, not user.role', () => {
    async function unreadFor(role: 'superadmin' | 'admin' | 'operator', globalRole: string) {
      const u = await createTestUser({ role: globalRole });
      await addMember(u.id, a.id, role);
      return callerFor(a, u).notifications.unreadCount();
    }

    it('admin and owner roles see the admin feed; operator sees nothing', async () => {
      expect(await unreadFor('admin', 'member')).toBe(3);
      expect(await unreadFor('superadmin', 'member')).toBe(3);
      expect(await unreadFor('operator', 'admin')).toBe(0);
    });

    it('a custom role sees a type only with its permission at scope all', async () => {
      // event.reschedule is one of the few permissions an 'own' scope can be stored on.
      const own = await createTestUser({ role: 'admin' });
      await addMemberWithGrants(own.id, a.id, [['event', 'reschedule', 'own']]);
      expect(await callerFor(a, own).notifications.unreadCount()).toBe(0);
      const rescheduler = await createTestUser();
      await addMemberWithGrants(rescheduler.id, a.id, [['event', 'reschedule', 'all']]);
      expect(await callerFor(a, rescheduler).notifications.unreadCount()).toBe(1);

      const all = await createTestUser();
      await addMemberWithGrants(all.id, a.id, [['quote', 'manage_assignment', 'all']]);
      expect(await callerFor(a, all).notifications.unreadCount()).toBe(2);
      const list = await callerFor(a, all).notifications.list(page());
      expect(list.items.map((n) => n.id).sort()).toEqual([na.confirmedId, na.cancelledId].sort());
    });
  });
});
