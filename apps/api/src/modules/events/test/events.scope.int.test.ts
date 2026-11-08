import { inArray } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { eventsListQuerySchema } from '@repo/schemas';
import { db } from '../../../db';
import { quotes } from '../../../db/schema';
import {
  addMember,
  addMemberWithGrants,
  createTestTenant,
  createTestUser,
  resetDb,
} from '../../../test/db';
import { seedEventsTenant, seedQuoteStages, type EventsSeed } from '../../../test/fixtures/events';
import { callerFor } from '../../../test/trpcCaller';

vi.mock('../../../lib/storage', () => ({
  getStorageProvider: () => ({ upload: vi.fn(), delete: vi.fn(async () => undefined) }),
}));

// The seed's events belong to `other`; `me` owns event2 (through quote2).
async function setup() {
  const tenant = await createTestTenant('tenant-a');
  const other = await createTestUser();
  const me = await createTestUser();
  await addMember(other.id, tenant.id, 'admin');
  await seedQuoteStages();
  const seed = await seedEventsTenant({ ...tenant, userId: other.id }, 'A');
  await db
    .update(quotes)
    .set({ createdById: me.id, assignedToId: me.id })
    .where(inArray(quotes.id, [seed.quote2Id]));
  return { tenant, me, seed };
}

const listIds = async (caller: ReturnType<typeof callerFor>) =>
  (await caller.events.list(eventsListQuerySchema.parse({}))).items.map((e) => e.id).sort();

const all = (s: EventsSeed) => [s.eventId, s.event2Id].sort();

describe('events router owner scope', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists every event for scope all and only own events for scope own', async () => {
    const { tenant, me, seed } = await setup();
    const admin = await createTestUser();
    await addMember(admin.id, tenant.id, 'admin');
    await addMember(me.id, tenant.id, 'operator');

    await expect(listIds(callerFor(tenant, admin))).resolves.toEqual(all(seed));
    await expect(listIds(callerFor(tenant, me))).resolves.toEqual([seed.event2Id]);
  });

  it('restricts to own events when the role has no event.read grant', async () => {
    const { tenant, me, seed } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [[RESOURCES.PAYMENT, ACTIONS.DELETE, 'all']]);
    const caller = callerFor(tenant, me);
    await expect(
      caller.events.removePaymentAttachment({
        eventId: seed.eventId,
        attachmentId: seed.attachmentId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('checks the scope of the gating action on mutations, not only event.read', async () => {
    const { tenant, me, seed } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [
      [RESOURCES.EVENT, ACTIONS.READ, 'all'],
      [RESOURCES.EVENT, ACTIONS.MANAGE_STAFF_ASSIGNMENTS, 'own'],
    ]);
    const caller = callerFor(tenant, me);

    await expect(listIds(caller)).resolves.toEqual(all(seed));
    await expect(
      caller.events.assignStaff({ eventId: seed.eventId, staffId: seed.freeStaffId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      caller.events.assignStaff({ eventId: seed.event2Id, staffId: seed.freeStaffId }),
    ).resolves.toBeDefined();
  });

  it('a payment action with scope own restricts even when event.read is all', async () => {
    const { tenant, me, seed } = await setup();
    await addMemberWithGrants(me.id, tenant.id, [
      [RESOURCES.EVENT, ACTIONS.READ, 'all'],
      [RESOURCES.PAYMENT, ACTIONS.DELETE, 'own'],
    ]);
    await expect(
      callerFor(tenant, me).events.removePaymentAttachment({
        eventId: seed.eventId,
        attachmentId: seed.attachmentId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'EVENT_NOT_FOUND' } });
  });
});
