import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import type { Database } from '../../../db';
import * as schema from '../../../db/schema';
import { eventPaymentAttachments, eventPayments } from '../../../db/schema';
import { settleBackgroundTasks } from '../../../lib/background';
import { addMember, createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { seedEventsTenant, seedQuoteStages, type EventsSeed } from '../../../test/fixtures/events';
import { testAppDatabaseUrl } from '../../../test/roles';
import { callerFor } from '../../../test/trpcCaller';
import { EventsService } from '../events.service';

// Each storage delete records whether the row it cleans up was still visible to another
// connection at that moment, i.e. whether the request transaction had already committed.
const seenRows = vi.hoisted(() => [] as number[]);
const probe = vi.hoisted(() => ({ rows: async (_key: string) => 0 }));
const storage = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ url: '' })),
  delete: vi.fn(async (key: string) => {
    seenRows.push(await probe.rows(key));
  }),
}));
vi.mock('../../../lib/storage', () => ({ getStorageProvider: () => storage }));

type Tenant = { id: string; slug: string; userId: string };

let appClient: ReturnType<typeof postgres>;
let appDb: Database;

beforeAll(() => {
  appClient = postgres(testAppDatabaseUrl(), { max: 2 });
  appDb = drizzle(appClient, { schema }) as unknown as Database;
  probe.rows = async (key) =>
    (
      await testDb
        .select({ id: eventPaymentAttachments.id })
        .from(eventPaymentAttachments)
        .where(eq(eventPaymentAttachments.key, key))
    ).length;
});

afterAll(async () => {
  await appClient?.end();
});

const attachmentRows = (key: string) => probe.rows(key);
const paymentRows = async (id: string) =>
  (
    await testDb
      .select({ id: eventPayments.id })
      .from(eventPayments)
      .where(eq(eventPayments.id, id))
  ).length;

describe('payment removals delete storage only after commit (app role)', () => {
  let tenant: Tenant;
  let seed: EventsSeed;

  beforeEach(async () => {
    await resetDb();
    await seedQuoteStages();
    const created = await createTestTenant('tenant-a');
    const owner = await createTestUser();
    await addMember(owner.id, created.id, 'superadmin');
    tenant = { ...created, userId: owner.id };
    seed = await seedEventsTenant(tenant, 'A');
    storage.delete.mockClear();
    seenRows.length = 0;
  });
  afterEach(async () => {
    await settleBackgroundTasks();
    vi.restoreAllMocks();
  });

  it('removePaymentAttachment deletes the file once the row removal has committed', async () => {
    const caller = callerFor(tenant, { id: tenant.userId }, appDb);
    await expect(
      caller.events.removePaymentAttachment({
        eventId: seed.eventId,
        attachmentId: seed.attachmentId,
      }),
    ).resolves.toEqual({ ok: true });
    await settleBackgroundTasks();

    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(seed.attachmentKey);
    expect(seenRows).toEqual([0]);
  });

  it('removePayment deletes the files once the payment removal has committed', async () => {
    const caller = callerFor(tenant, { id: tenant.userId }, appDb);
    await expect(
      caller.events.removePayment({ eventId: seed.eventId, paymentId: seed.paymentId }),
    ).resolves.toEqual({ ok: true });
    await settleBackgroundTasks();

    expect(storage.delete).toHaveBeenCalledExactlyOnceWith(seed.attachmentKey);
    expect(seenRows).toEqual([0]);
    expect(await paymentRows(seed.paymentId)).toBe(0);
  });

  it('a storage failure is logged and the removal still succeeds', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storage.delete.mockRejectedValueOnce(new Error('r2 down'));
    const caller = callerFor(tenant, { id: tenant.userId }, appDb);

    await expect(
      caller.events.removePaymentAttachment({
        eventId: seed.eventId,
        attachmentId: seed.attachmentId,
      }),
    ).resolves.toEqual({ ok: true });
    await settleBackgroundTasks();

    expect(errors).toHaveBeenCalledWith('storage delete failed', expect.anything());
    expect(await attachmentRows(seed.attachmentKey)).toBe(0);
  });

  it('a request that rolls back after removePaymentAttachment deletes no file', async () => {
    const original = EventsService.prototype.removePaymentAttachment;
    vi.spyOn(EventsService.prototype, 'removePaymentAttachment').mockImplementation(async function (
      this: EventsService,
      ...args
    ) {
      await original.apply(this, args);
      throw new TRPCError({ code: 'CONFLICT' });
    });
    const caller = callerFor(tenant, { id: tenant.userId }, appDb);

    await expect(
      caller.events.removePaymentAttachment({
        eventId: seed.eventId,
        attachmentId: seed.attachmentId,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await settleBackgroundTasks();

    expect(storage.delete).not.toHaveBeenCalled();
    expect(await attachmentRows(seed.attachmentKey)).toBe(1);
  });

  it('a request that rolls back after removePayment deletes no file', async () => {
    const original = EventsService.prototype.removePayment;
    vi.spyOn(EventsService.prototype, 'removePayment').mockImplementation(async function (
      this: EventsService,
      ...args
    ) {
      await original.apply(this, args);
      throw new TRPCError({ code: 'CONFLICT' });
    });
    const caller = callerFor(tenant, { id: tenant.userId }, appDb);

    await expect(
      caller.events.removePayment({ eventId: seed.eventId, paymentId: seed.paymentId }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await settleBackgroundTasks();

    expect(storage.delete).not.toHaveBeenCalled();
    expect(await paymentRows(seed.paymentId)).toBe(1);
    expect(await attachmentRows(seed.attachmentKey)).toBe(1);
  });
});
