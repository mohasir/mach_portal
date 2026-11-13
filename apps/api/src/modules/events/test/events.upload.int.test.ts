import type { Request, Response, Router } from 'express';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { eq, sql } from 'drizzle-orm';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { createContext } from '../../../core/trpc/context';
import { appRouter } from '../../../core/trpc/router';
import { db, type Database } from '../../../db';
import * as schema from '../../../db/schema';
import { eventPaymentAttachments, quotes } from '../../../db/schema';
import {
  createUserWithPassword,
  signInCookie,
  signInWithActiveOrg,
} from '../../../test/authHelpers';
import {
  addMember,
  addMemberWithGrants,
  createTestTenant,
  resetDb,
  type TestTenant,
} from '../../../test/db';
import {
  insertPayment,
  seedEventsTenant,
  seedQuoteStages,
  type EventsSeed,
} from '../../../test/fixtures/events';
import { resolveTenantById } from '../../../lib/tenancy/tenantResolver';
import { TEST_APP_ROLE, testAppDatabaseUrl } from '../../../test/roles';
import { EventsRepository } from '../events.repository';

const storage = vi.hoisted(() => ({
  upload: vi.fn(async ({ key }: { key: string }) => ({ url: `http://r2/${key}` })),
  delete: vi.fn(async () => undefined),
}));
vi.mock('../../../lib/storage', () => ({ getStorageProvider: () => storage }));

const { eventAttachmentsRouter, createEventAttachmentsRouter } = await import('../events.express');

type Reply = { status: number | null; body: unknown };

// Drives the real router (guard, multipart parser, handler and error handler) with a request
// that already carries the parsed file: the parser lets non-multipart requests through untouched.
function post(
  paymentId: string,
  cookie?: string,
  router: Router = eventAttachmentsRouter,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const out: Reply = { status: null, body: undefined };
    const headers: Record<string, string> = {};
    if (cookie) headers['cookie'] = cookie;
    const path = `/${paymentId}/attachments`;
    const req = {
      method: 'POST',
      url: path,
      originalUrl: `/api/uploads/event-payments${path}`,
      baseUrl: '/api/uploads/event-payments',
      path,
      headers,
      file: {
        buffer: Buffer.from('png'),
        mimetype: 'image/png',
        originalname: 'receipt.png',
        size: 3,
      },
    } as unknown as Request;
    const res = {
      locals: {},
      headersSent: false,
      status(code: number) {
        out.status = code;
        return this;
      },
      json(body: unknown) {
        out.body = body;
        resolve(out);
        return this;
      },
    } as unknown as Response;
    router(req, res, (err?: unknown) =>
      err ? reject(err) : reject(new Error('request fell through the router')),
    );
  });
}

const attachmentsOf = (tenantId: string) =>
  db.select().from(eventPaymentAttachments).where(eq(eventPaymentAttachments.tenantId, tenantId));

describe('payment attachment upload route', () => {
  let a: TestTenant;
  let b: TestTenant;
  let sa: EventsSeed;
  let sb: EventsSeed;

  beforeEach(async () => {
    await resetDb();
    storage.upload.mockClear();
    storage.delete.mockClear();
    const tenantA = await createTestTenant('tenant-a');
    const tenantB = await createTestTenant('tenant-b');
    const owner = await createUserWithPassword('owner@test.local');
    await addMember(owner, tenantA.id, 'admin');
    await addMember(owner, tenantB.id, 'admin');
    a = { ...tenantA, userId: owner };
    b = { ...tenantB, userId: owner };
    await seedQuoteStages();
    sa = await seedEventsTenant(a, 'A');
    sb = await seedEventsTenant(b, 'B');
  });
  afterEach(() => vi.restoreAllMocks());

  it('401 without a session; nothing is uploaded', async () => {
    const r = await post(sa.paymentId);
    expect(r).toEqual({ status: 401, body: { errorCode: 'UNAUTHORIZED' } });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('403 TENANT_NOT_SELECTED for a session without an active organization', async () => {
    const userId = await createUserWithPassword('multi@test.local');
    await addMember(userId, a.id);
    await addMember(userId, b.id);
    const cookie = await signInCookie('multi@test.local');
    const r = await post(sa.paymentId, cookie);
    expect(r).toEqual({ status: 403, body: { errorCode: 'TENANT_NOT_SELECTED' } });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN when the role lacks the upload permission', async () => {
    const userId = await createUserWithPassword('op@test.local', { role: 'superadmin' });
    await addMember(userId, a.id, 'operator');
    const cookie = await signInCookie('op@test.local');
    const r = await post(sa.paymentId, cookie);
    expect(r).toEqual({ status: 403, body: { errorCode: 'FORBIDDEN' } });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(await attachmentsOf(a.id)).toHaveLength(1);
  });

  it('404 EVENT_PAYMENT_NOT_FOUND for a payment of another tenant; nothing uploaded or inserted', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, b.id);
    const r = await post(sa.paymentId, cookie);
    expect(r).toEqual({ status: 404, body: { errorCode: 'EVENT_PAYMENT_NOT_FOUND' } });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(await attachmentsOf(a.id)).toHaveLength(1);
    expect(await attachmentsOf(b.id)).toHaveLength(1);
  });

  it('201 stamps the active tenant and stores the file under its prefix', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, b.id);
    const r = await post(sb.paymentId, cookie);
    expect(r.status).toBe(201);
    expect(storage.upload).toHaveBeenCalledOnce();
    const key = storage.upload.mock.calls[0]![0].key;
    expect(key).toMatch(new RegExp(`^t/${b.id}/event-payments/[0-9a-f-]{36}\\.png$`));
    const rows = await attachmentsOf(b.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.key === key)).toMatchObject({
      paymentId: sb.paymentId,
      createdById: b.userId,
      fileName: 'receipt.png',
    });
    expect(r.body).toMatchObject({ id: rows.find((row) => row.key === key)!.id });
    expect(await attachmentsOf(a.id)).toHaveLength(1);
  });

  it('removes the uploaded file when the row cannot be inserted', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    vi.spyOn(EventsRepository.prototype, 'createAttachment').mockRejectedValueOnce(
      new Error('insert failed'),
    );
    const r = await post(sa.paymentId, cookie);
    expect(r).toEqual({
      status: 500,
      body: { errorCode: 'EVENT_PAYMENT_ATTACHMENT_UPLOAD_FAILED' },
    });
    const key = storage.upload.mock.calls[0]![0].key;
    expect(storage.delete).toHaveBeenCalledWith(key);
  });
});

describe('payment attachment upload owner scope (parity with tRPC)', () => {
  let a: TestTenant;
  let sa: EventsSeed;

  beforeEach(async () => {
    await resetDb();
    storage.upload.mockClear();
    const tenant = await createTestTenant('tenant-a');
    const owner = await createUserWithPassword('owner@test.local');
    await addMember(owner, tenant.id, 'admin');
    a = { ...tenant, userId: owner };
    await seedQuoteStages();
    sa = await seedEventsTenant(a, 'A');
  });

  async function trpcCaller(cookie: string) {
    return appRouter.createCaller(
      await createContext({
        req: { headers: { cookie } },
        res: { setHeader: () => undefined },
      } as unknown as CreateExpressContextOptions),
    );
  }

  it("event.read own: 404 on someone else's payment in Express and NOT_FOUND in tRPC; own payment uploads", async () => {
    const me = await createUserWithPassword('me@test.local');
    await addMemberWithGrants(me, a.id, [
      [RESOURCES.EVENT, ACTIONS.READ, 'own'],
      [RESOURCES.PAYMENT, ACTIONS.UPLOAD_ATTACHMENT, 'all'],
      [RESOURCES.PAYMENT, ACTIONS.DELETE, 'all'],
    ]);
    await db
      .update(quotes)
      .set({ createdById: me, assignedToId: me })
      .where(eq(quotes.id, sa.quote2Id));
    const ownPaymentId = await insertPayment(a.id, sa.event2Id, 100);
    const cookie = await signInCookie('me@test.local');

    const r = await post(sa.paymentId, cookie);
    expect(r).toEqual({ status: 404, body: { errorCode: 'EVENT_PAYMENT_NOT_FOUND' } });
    expect(storage.upload).not.toHaveBeenCalled();
    await expect(
      (await trpcCaller(cookie)).events.removePaymentAttachment({
        eventId: sa.eventId,
        attachmentId: sa.attachmentId,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await attachmentsOf(a.id)).toHaveLength(1);

    const own = await post(ownPaymentId, cookie);
    expect(own.status).toBe(201);
  });

  it('payment.upload_attachment own restricts even when event.read is all', async () => {
    const me = await createUserWithPassword('me@test.local');
    await addMemberWithGrants(me, a.id, [
      [RESOURCES.EVENT, ACTIONS.READ, 'all'],
      [RESOURCES.PAYMENT, ACTIONS.UPLOAD_ATTACHMENT, 'own'],
    ]);
    const cookie = await signInCookie('me@test.local');
    const r = await post(sa.paymentId, cookie);
    expect(r).toEqual({ status: 404, body: { errorCode: 'EVENT_PAYMENT_NOT_FOUND' } });
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe('payment attachment upload route with the app role', () => {
  let appClient: ReturnType<typeof postgres>;
  let appRoleRouter: Router;
  let a: TestTenant;
  let b: TestTenant;
  let sa: EventsSeed;
  let sb: EventsSeed;

  beforeAll(() => {
    appClient = postgres(testAppDatabaseUrl(), { max: 2 });
    appRoleRouter = createEventAttachmentsRouter(
      drizzle(appClient, { schema }) as unknown as Database,
    );
  });
  afterAll(async () => {
    await appClient?.end();
  });

  beforeEach(async () => {
    await resetDb();
    storage.upload.mockClear();
    storage.delete.mockClear();
    const tenantA = await createTestTenant('tenant-a');
    const tenantB = await createTestTenant('tenant-b');
    const owner = await createUserWithPassword('owner@test.local');
    await addMember(owner, tenantA.id, 'admin');
    await addMember(owner, tenantB.id, 'admin');
    a = { ...tenantA, userId: owner };
    b = { ...tenantB, userId: owner };
    await seedQuoteStages();
    sa = await seedEventsTenant(a, 'A');
    sb = await seedEventsTenant(b, 'B');
  });
  afterEach(() => vi.restoreAllMocks());

  // The organization row is cached by the resolver; warming it first leaves the app-role client as
  // the only one the route may use. Every method that would take a global-pool connection is spied.
  async function spyGlobalPool(tenantId: string) {
    await resolveTenantById(tenantId);
    return (
      [
        'select',
        'selectDistinct',
        'selectDistinctOn',
        '$count',
        'with',
        'insert',
        'update',
        'delete',
        'execute',
        'transaction',
      ] as const
    ).map((method) => vi.spyOn(db, method));
  }

  it('404 EVENT_PAYMENT_NOT_FOUND for a payment of another tenant; nothing uploaded or inserted', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, b.id);
    const spies = await spyGlobalPool(b.id);
    const r = await post(sa.paymentId, cookie, appRoleRouter);
    expect(r).toEqual({ status: 404, body: { errorCode: 'EVENT_PAYMENT_NOT_FOUND' } });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(await attachmentsOf(a.id)).toHaveLength(1);
    expect(await attachmentsOf(b.id)).toHaveLength(1);
  });

  it('201 for a payment of the session tenant, stored under that tenant', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, b.id);
    const spies = await spyGlobalPool(b.id);
    const r = await post(sb.paymentId, cookie, appRoleRouter);
    expect(r.status).toBe(201);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(await attachmentsOf(b.id)).toHaveLength(2);
    expect(await attachmentsOf(a.id)).toHaveLength(1);
  });

  it('403 FORBIDDEN when the role lacks the upload permission', async () => {
    const userId = await createUserWithPassword('op@test.local', { role: 'superadmin' });
    await addMember(userId, a.id, 'operator');
    const cookie = await signInCookie('op@test.local');
    const r = await post(sa.paymentId, cookie, appRoleRouter);
    expect(r).toEqual({ status: 403, body: { errorCode: 'FORBIDDEN' } });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('holds no transaction while the file is being uploaded', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    let idleInTxDuringUpload: number | undefined;
    storage.upload.mockImplementationOnce(async ({ key }: { key: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      idleInTxDuringUpload = await appConnectionsIdleInTx();
      return { url: `http://r2/${key}` };
    });
    const r = await post(sa.paymentId, cookie, appRoleRouter);
    expect(r.status).toBe(201);
    expect(idleInTxDuringUpload).toBe(0);
    expect(await attachmentsOf(a.id)).toHaveLength(2);
  });

  it('deletes the uploaded file and keeps the original error when the row cannot be saved', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    vi.spyOn(EventsRepository.prototype, 'createAttachment').mockRejectedValueOnce(
      new Error('insert failed'),
    );
    const r = await post(sa.paymentId, cookie, appRoleRouter);
    expect(r).toEqual({
      status: 500,
      body: { errorCode: 'EVENT_PAYMENT_ATTACHMENT_UPLOAD_FAILED' },
    });
    expect(storage.upload).toHaveBeenCalledOnce();
    const key = storage.upload.mock.calls[0]![0].key;
    expect(storage.delete).toHaveBeenCalledWith(key);
    expect(await attachmentsOf(a.id)).toHaveLength(1);
  });
});

const IDLE_IN_TX = sql`
  select count(*)::int as n from pg_stat_activity
  where usename = ${TEST_APP_ROLE} and state like 'idle in transaction%'`;

async function appConnectionsIdleInTx(): Promise<number> {
  const rows = (await db.execute(IDLE_IN_TX)) as unknown as { n: number }[];
  return rows[0]!.n;
}
