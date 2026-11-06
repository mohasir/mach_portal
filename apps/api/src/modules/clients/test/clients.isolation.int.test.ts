import { beforeEach, describe, expect, it } from 'vitest';
import { clientsListQuerySchema, QUOTE_STAGE } from '@repo/schemas';
import { clients, quotes, quoteStages } from '../../../db/schema';
import { seedTwoTenants, resetDb, testDb, type TestTenant } from '../../../test/db';
import { ClientsRepository } from '../clients.repository';
import { ClientsService } from '../clients.service';

const listAll = clientsListQuerySchema.parse({});

async function insertClient(tenant: TestTenant, name: string) {
  const [row] = await testDb
    .insert(clients)
    .values({ tenantId: tenant.id, name })
    .returning({ id: clients.id });
  return row!.id;
}

async function insertQuote(tenantId: string, clientId: string, seq: number, stageId: number) {
  await testDb.insert(quotes).values({
    tenantId,
    seq,
    number: `QUO-${tenantId.slice(0, 4)}-${seq}`,
    clientId,
    stageId,
    taxRate: 0.08,
  });
}

describe('clients tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: ClientsRepository;
  let repoB: ClientsRepository;
  let clientA: string;
  let clientB: string;

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
    clientA = await insertClient(a, 'Alice A');
    clientB = await insertClient(b, 'Bob B');
    await insertClient(b, 'Alice B');
    repoA = new ClientsRepository(testDb, a.id);
    repoB = new ClientsRepository(testDb, b.id);
  });

  it('findPaginated lists and counts only the tenant rows', async () => {
    const resA = await repoA.findPaginated(listAll);
    expect(resA.items.map((c) => c.name)).toEqual(['Alice A']);
    const resB = await repoB.findPaginated(listAll);
    expect(resB.items).toHaveLength(2);
    expect(resB.total).toBe(2);
  });

  it('findPaginated total ignores other tenants when paginating and searching', async () => {
    const res = await repoA.findPaginated(
      clientsListQuerySchema.parse({ page: 1, pageSize: 10, search: 'alice' }),
    );
    expect(res.items.map((c) => c.name)).toEqual(['Alice A']);
    expect(res.total).toBe(1);
  });

  it('findById does not return another tenant row', async () => {
    expect(await repoA.findById(clientB)).toBeUndefined();
    expect((await repoA.findById(clientA))?.id).toBe(clientA);
  });

  it('create stamps the repository tenant', async () => {
    const created = await repoA.create({ name: 'New A' });
    const all = await testDb.select({ id: clients.id, tenantId: clients.tenantId }).from(clients);
    expect(all.find((r) => r.id === created.id)?.tenantId).toBe(a.id);
  });

  it('updateById cannot modify another tenant row', async () => {
    expect(await repoA.updateById(clientB, { name: 'Hacked' })).toBeUndefined();
    expect((await repoB.findById(clientB))?.name).toBe('Bob B');
  });

  it('deleteById cannot delete another tenant row', async () => {
    expect(await repoA.deleteById(clientB)).toBeUndefined();
    expect(await repoB.findById(clientB)).toBeDefined();
    expect(await repoA.deleteById(clientA)).toEqual({ id: clientA });
  });

  it('deleting a client with quotes is CLIENT_IN_USE and keeps the row', async () => {
    await insertQuote(a.id, clientA, 1, QUOTE_STAGE.CONFIRMED);
    await expect(new ClientsService(repoA).remove(clientA)).rejects.toMatchObject({
      code: 'CONFLICT',
      cause: { code: 'CLIENT_IN_USE' },
    });
    expect(await repoA.findById(clientA)).toBeDefined();
  });

  it('a client of another tenant with quotes stays NOT_FOUND, never IN_USE', async () => {
    await insertQuote(b.id, clientB, 1, QUOTE_STAGE.CONFIRMED);
    await expect(new ClientsService(repoA).remove(clientB)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'CLIENT_NOT_FOUND' },
    });
    expect(await repoB.findById(clientB)).toBeDefined();
  });

  it('derived status ignores confirmed quotes stored under another tenant', async () => {
    // Deliberately inconsistent row: quote points at A's client but belongs to B.
    await insertQuote(b.id, clientA, 1, QUOTE_STAGE.CONFIRMED);
    expect((await repoA.findById(clientA))?.status).toBe('lead');
    const list = await repoA.findPaginated(listAll);
    expect(list.items[0]?.status).toBe('lead');
  });

  it('derived status is active for a confirmed quote of the same tenant', async () => {
    await insertQuote(a.id, clientA, 1, QUOTE_STAGE.CONFIRMED);
    expect((await repoA.findById(clientA))?.status).toBe('active');
  });
});
