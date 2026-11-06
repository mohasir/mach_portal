import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { QUOTE_STAGE } from '@repo/schemas';
import { appSettings, clients, quoteStages, quotes } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { QuotesRepository } from '../quotes.repository';

const numberFor = (seq: number) => `QUO20300101-${String(seq).padStart(6, '0')}`;

async function seedTenant(tenant: TestTenant, quoteSeqStart = 1) {
  await testDb.insert(appSettings).values({ tenantId: tenant.id, quoteSeqStart });
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId: tenant.id, name: `Client ${tenant.slug}` })
    .returning({ id: clients.id });
  return client!.id;
}

function create(repo: QuotesRepository, tenant: TestTenant, clientId: string) {
  return repo
    .insertFull({ clientId, taxRate: 0.08, createdById: tenant.userId }, numberFor, [])
    .then((r) => {
      if (!('id' in r)) throw new Error(`unexpected missing ref ${r.missingRef}`);
      return r;
    });
}

async function seqsOf(tenant: TestTenant) {
  const rows = await testDb
    .select({ seq: quotes.seq })
    .from(quotes)
    .where(eq(quotes.tenantId, tenant.id));
  return rows.map((r) => r.seq).sort((x, y) => x - y);
}

const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);

describe('quotes numbering per tenant', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: QuotesRepository;
  let repoB: QuotesRepository;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    await testDb.insert(quoteStages).values(
      Object.values(QUOTE_STAGE).map((id) => ({
        id,
        label: `stage ${id}`,
        color: '#000000',
        sortOrder: id,
      })),
    );
    repoA = new QuotesRepository(testDb, a.id);
    repoB = new QuotesRepository(testDb, b.id);
  });

  it('both tenants start at seq 1 and may share the same number', async () => {
    const clientA = await seedTenant(a);
    const clientB = await seedTenant(b);
    const qa = await create(repoA, a, clientA);
    const qb = await create(repoB, b, clientB);
    expect(qa.seq).toBe(1);
    expect(qb.seq).toBe(1);
    expect(qa.number).toBe(qb.number);
    expect((await create(repoA, a, clientA)).seq).toBe(2);
    expect((await create(repoB, b, clientB)).seq).toBe(2);
  });

  it('nextSeq only looks at the tenant quotes', async () => {
    const clientA = await seedTenant(a);
    await seedTenant(b);
    for (let i = 0; i < 3; i++) await create(repoA, a, clientA);
    expect(await testDb.transaction((tx) => repoA.nextSeq(tx))).toBe(4);
    expect(await testDb.transaction((tx) => repoB.nextSeq(tx))).toBe(1);
  });

  it('quoteSeqStart applies per tenant and never goes below the last used seq', async () => {
    const clientA = await seedTenant(a, 100);
    const clientB = await seedTenant(b);
    expect((await create(repoA, a, clientA)).seq).toBe(100);
    expect((await create(repoB, b, clientB)).seq).toBe(1);
    expect((await create(repoA, a, clientA)).seq).toBe(101);

    await testDb
      .update(appSettings)
      .set({ quoteSeqStart: 50 })
      .where(eq(appSettings.tenantId, a.id));
    expect((await create(repoA, a, clientA)).seq).toBe(102);
  });

  it('50 concurrent creations in one tenant get unique consecutive seqs', async () => {
    const clientA = await seedTenant(a);
    await seedTenant(b);
    const created = await Promise.all(range(0, 50).map(() => create(repoA, a, clientA)));
    expect(created.map((q) => q.seq).sort((x, y) => x - y)).toEqual(range(1, 50));
    expect(new Set(created.map((q) => q.number)).size).toBe(50);
    expect(await seqsOf(a)).toEqual(range(1, 50));
    expect(await seqsOf(b)).toEqual([]);
  });

  it('concurrent creations in two tenants keep independent sequences', async () => {
    const clientA = await seedTenant(a);
    const clientB = await seedTenant(b, 10);
    const jobs = range(0, 25).flatMap(() => [create(repoA, a, clientA), create(repoB, b, clientB)]);
    await Promise.all(jobs);
    expect(await seqsOf(a)).toEqual(range(1, 25));
    expect(await seqsOf(b)).toEqual(range(10, 25));
  });
});
