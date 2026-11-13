import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { createQuoteSchema, updateQuoteSchema } from '@repo/schemas';
import type { TenantCtx } from '../../../core/trpc/tenantCtx';
import { withTenantTx, type Database } from '../../../db';
import * as schema from '../../../db/schema';
import { quotes } from '../../../db/schema';
import { settleBackgroundTasks } from '../../../lib/background';
import { addMember, createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { seedEventsTenant, seedQuoteStages, type EventsSeed } from '../../../test/fixtures/events';
import { TEST_APP_ROLE, testAppDatabaseUrl } from '../../../test/roles';
import { callerFor } from '../../../test/trpcCaller';
import { quotesModule } from '../quotes.module';
import { QuotePdfGenerator, QuotesService } from '../quotes.service';

const pdfService = vi.hoisted(() => ({ generateQuotePdf: vi.fn() }));
vi.mock('../../../lib/pdfService/client', () => pdfService);

type Seeded = { tenant: { id: string; slug: string; userId: string }; seed: EventsSeed };

const IDLE_IN_TX = sql`
  select count(*)::int as n from pg_stat_activity
  where usename = ${TEST_APP_ROLE} and state like 'idle in transaction%'`;

async function appConnectionsIdleInTx(): Promise<number> {
  const rows = (await testDb.execute(IDLE_IN_TX)) as unknown as { n: number }[];
  return rows[0]!.n;
}

let appClient: ReturnType<typeof postgres>;
let appDb: Database;

beforeAll(() => {
  appClient = postgres(testAppDatabaseUrl(), { max: 2 });
  appDb = drizzle(appClient, { schema }) as unknown as Database;
});

afterAll(async () => {
  await appClient?.end();
});

async function seedTenant(slug: string, label: string): Promise<Seeded> {
  const created = await createTestTenant(slug);
  const owner = await createTestUser();
  await addMember(owner.id, created.id, 'superadmin');
  const tenant = { ...created, userId: owner.id };
  return { tenant, seed: await seedEventsTenant(tenant, label) };
}

const pdfRow = async (id: string) =>
  (
    await testDb
      .select({ pdfUrl: quotes.pdfUrl, pdfKey: quotes.pdfKey })
      .from(quotes)
      .where(eq(quotes.id, id))
  )[0];

describe('quote PDF generation outside the request transaction (app role)', () => {
  let a: Seeded;
  let b: Seeded;
  // Sampled while the (simulated, slow) PDF service is working.
  let idleInTxDuringPdf: number[];

  beforeEach(async () => {
    await resetDb();
    await seedQuoteStages();
    a = await seedTenant('tenant-a', 'A');
    b = await seedTenant('tenant-b', 'B');
    idleInTxDuringPdf = [];
    pdfService.generateQuotePdf.mockReset();
    pdfService.generateQuotePdf.mockImplementation(async (payload: { document_number: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      idleInTxDuringPdf.push(await appConnectionsIdleInTx());
      const key = `quotes/${payload.document_number}.pdf`;
      return { url: `http://pdf/${key}`, key };
    });
  });
  afterEach(async () => {
    await settleBackgroundTasks();
    vi.restoreAllMocks();
  });

  it('generatePdf holds no transaction during the PDF call and stores the result', async () => {
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);
    const result = await caller.quotes.generatePdf({ id: a.seed.quoteId });

    expect(pdfService.generateQuotePdf).toHaveBeenCalledOnce();
    expect(idleInTxDuringPdf).toEqual([0]);
    expect(result).toMatchObject({
      id: a.seed.quoteId,
      pdfUrl: 'http://pdf/quotes/QUO-000001.pdf',
    });
    expect(await pdfRow(a.seed.quoteId)).toEqual({
      pdfUrl: 'http://pdf/quotes/QUO-000001.pdf',
      pdfKey: 'quotes/QUO-000001.pdf',
    });
  });

  it('regeneratePdf holds no transaction during the PDF call', async () => {
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);
    await caller.quotes.regeneratePdf({ id: a.seed.quoteId });
    expect(idleInTxDuringPdf).toEqual([0]);
    expect((await pdfRow(a.seed.quoteId))?.pdfKey).toBe('quotes/QUO-000001.pdf');
  });

  it('a quote of another tenant is NOT_FOUND and the PDF service is never called', async () => {
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);
    await expect(caller.quotes.generatePdf({ id: b.seed.quoteId })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'QUOTE_NOT_FOUND' },
    });
    expect(pdfService.generateQuotePdf).not.toHaveBeenCalled();
    expect((await pdfRow(b.seed.quoteId))?.pdfUrl).toBeNull();
  });

  it('keeps PDF_NOT_ALLOWED and PDF_GENERATION_FAILED', async () => {
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);
    await expect(caller.quotes.generatePdf({ id: a.seed.freeQuoteId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      cause: { code: 'QUOTE_PDF_NOT_ALLOWED' },
    });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    pdfService.generateQuotePdf.mockRejectedValueOnce(new Error('pdf down'));
    await expect(caller.quotes.generatePdf({ id: a.seed.quoteId })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      cause: { code: 'QUOTE_PDF_GENERATION_FAILED' },
    });
    expect((await pdfRow(a.seed.quoteId))?.pdfUrl).toBeNull();
  });

  it('create generates the PDF in the background once the request has committed', async () => {
    const errors = vi.spyOn(console, 'error');
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);
    const [tier] = await testDb.execute<{ product_id: string }>(
      sql`select product_id from product_price_tiers where tenant_id = ${a.tenant.id}`,
    );

    const created = await caller.quotes.create({
      clientId: a.seed.clientId,
      isDraft: false,
      selectOptionsAtQuote: false,
      lines: [{ productId: tier!.product_id, numPersons: 10, subtotal: 1000, selections: [] }],
    });
    await settleBackgroundTasks();

    expect(errors).not.toHaveBeenCalled();
    expect(pdfService.generateQuotePdf).toHaveBeenCalledOnce();
    expect(idleInTxDuringPdf).toEqual([0]);
    expect((await pdfRow(created.id))?.pdfKey).toBe(`quotes/${created.number}.pdf`);
  });

  it('a failed create starts no background generation', async () => {
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);
    await expect(
      caller.quotes.create({
        clientId: b.seed.clientId,
        isDraft: false,
        selectOptionsAtQuote: false,
        lines: [],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await settleBackgroundTasks();
    expect(pdfService.generateQuotePdf).not.toHaveBeenCalled();
  });

  it('a background failure is logged and does not affect the response', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    pdfService.generateQuotePdf.mockRejectedValueOnce(new Error('pdf down'));
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);

    const created = await caller.quotes.create({
      clientId: a.seed.clientId,
      isDraft: false,
      selectOptionsAtQuote: false,
      lines: [],
    });
    expect(created.id).toBeDefined();
    await settleBackgroundTasks();

    expect(errors).toHaveBeenCalledWith('background pdf generation failed', expect.anything());
    expect((await pdfRow(created.id))?.pdfUrl).toBeNull();
  });

  it('create and update schedule the PDF after commit without running it', async () => {
    const scheduled: Array<() => void> = [];
    const ctx = {
      tenantId: a.tenant.id,
      db: testDb,
      runInTenant: (fn) => withTenantTx(a.tenant.id, fn, appDb),
      afterCommit: (task) => {
        scheduled.push(task);
      },
    } as Pick<TenantCtx, 'tenantId' | 'db' | 'runInTenant' | 'afterCommit'> as TenantCtx;
    const service = quotesModule(ctx);

    const created = await service.create(
      createQuoteSchema.parse({ clientId: a.seed.clientId, isDraft: false }),
      a.tenant.userId,
      true,
    );
    expect(scheduled).toHaveLength(1);
    await service.update(
      a.seed.freeQuoteId,
      updateQuoteSchema.parse({ clientId: a.seed.clientId, isDraft: false }),
      true,
    );
    expect(scheduled).toHaveLength(2);
    await settleBackgroundTasks();
    expect(pdfService.generateQuotePdf).not.toHaveBeenCalled();

    for (const task of scheduled) task();
    await settleBackgroundTasks();
    expect(pdfService.generateQuotePdf).toHaveBeenCalledTimes(2);
    expect((await pdfRow(created.id))?.pdfKey).toBe(`quotes/${created.number}.pdf`);
    expect((await pdfRow(a.seed.freeQuoteId))?.pdfKey).toBe('quotes/QUO-000003.pdf');
  });

  it('a request that rolls back after scheduling the PDF never runs it', async () => {
    const create = QuotesService.prototype.create;
    const spy = vi.spyOn(QuotesService.prototype, 'create').mockImplementation(async function (
      this: QuotesService,
      ...args
    ) {
      await create.apply(this, args);
      throw new TRPCError({ code: 'CONFLICT' });
    });
    const scheduledPdf = vi.spyOn(
      QuotesService.prototype as unknown as { generatePdfInBackground: () => void },
      'generatePdfInBackground',
    );
    const generate = vi.spyOn(QuotePdfGenerator.prototype, 'generate');
    const before = await testDb.select({ id: quotes.id }).from(quotes);
    const caller = callerFor(a.tenant, { id: a.tenant.userId }, appDb);

    await expect(
      caller.quotes.create({
        clientId: a.seed.clientId,
        isDraft: false,
        selectOptionsAtQuote: false,
        lines: [],
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(spy).toHaveBeenCalledOnce();
    expect(scheduledPdf).toHaveBeenCalledOnce();
    await settleBackgroundTasks();

    expect(generate).not.toHaveBeenCalled();
    expect(pdfService.generateQuotePdf).not.toHaveBeenCalled();
    expect(await testDb.select({ id: quotes.id }).from(quotes)).toHaveLength(before.length);
  });
});
