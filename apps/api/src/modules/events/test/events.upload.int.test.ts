import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { eq } from 'drizzle-orm';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { createContext } from '../../../core/trpc/context';
import { appRouter } from '../../../core/trpc/router';
import { db } from '../../../db';
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

const storage = vi.hoisted(() => ({
  upload: vi.fn(async ({ key }: { key: string }) => ({ url: `http://r2/${key}` })),
  delete: vi.fn(async () => undefined),
}));
vi.mock('../../../lib/storage', () => ({ getStorageProvider: () => storage }));

const { eventAttachmentsRouter } = await import('../events.express');

type Reply = { status: number | null; body: unknown };

// Drives the real router (guard, multipart parser, handler and error handler) with a request
// that already carries the parsed file: the parser lets non-multipart requests through untouched.
function post(paymentId: string, cookie?: string): Promise<Reply> {
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
    eventAttachmentsRouter(req, res, (err?: unknown) =>
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
    vi.spyOn(db, 'insert').mockImplementation((() => {
      throw new Error('insert failed');
    }) as typeof db.insert);
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
