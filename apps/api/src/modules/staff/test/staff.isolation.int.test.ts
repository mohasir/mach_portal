import { beforeEach, describe, expect, it } from 'vitest';
import { QUOTE_STAGE, staffListQuerySchema } from '@repo/schemas';
import { clients, events, eventStaff, quotes, quoteStages, staff } from '../../../db/schema';
import { seedTwoTenants, resetDb, testDb, type TestTenant } from '../../../test/db';
import { StaffRepository } from '../staff.repository';
import { StaffService } from '../staff.service';

const listAll = staffListQuerySchema.parse({});
const DATE = '2030-01-15';
let seq = 0;

async function insertStaff(tenant: TestTenant, name: string) {
  const [row] = await testDb
    .insert(staff)
    .values({ tenantId: tenant.id, name })
    .returning({ id: staff.id });
  return row!.id;
}

// Each tenant argument is independent so tests can build deliberately inconsistent
// cross-tenant rows (the DB does not validate the tenant on foreign keys).
async function assign(
  staffId: string,
  tenants: { quote: TestTenant; event: TestTenant; eventStaff: TestTenant },
) {
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId: tenants.quote.id, name: `c${++seq}` })
    .returning({ id: clients.id });
  const [quote] = await testDb
    .insert(quotes)
    .values({
      tenantId: tenants.quote.id,
      seq: ++seq,
      number: `Q-${seq}`,
      clientId: client!.id,
      stageId: QUOTE_STAGE.CONFIRMED,
      taxRate: 0.08,
    })
    .returning({ id: quotes.id });
  const [event] = await testDb
    .insert(events)
    .values({
      tenantId: tenants.event.id,
      quoteId: quote!.id,
      clientId: client!.id,
      eventDate: DATE,
      totalAmount: 100,
    })
    .returning({ id: events.id });
  await testDb
    .insert(eventStaff)
    .values({ tenantId: tenants.eventStaff.id, eventId: event!.id, staffId });
}

describe('staff tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: StaffRepository;
  let repoB: StaffRepository;
  let staffA: string;
  let staffB: string;

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
    staffA = await insertStaff(a, 'Ana A');
    staffB = await insertStaff(b, 'Ana B');
    await insertStaff(b, 'Zed B');
    repoA = new StaffRepository(testDb, a.id);
    repoB = new StaffRepository(testDb, b.id);
  });

  it('findPaginated lists and counts only the tenant rows', async () => {
    const resA = await repoA.findPaginated(listAll);
    expect(resA.items.map((s) => s.name)).toEqual(['Ana A']);
    const resB = await repoB.findPaginated(listAll);
    expect(resB.items).toHaveLength(2);
  });

  it('findPaginated total and search ignore other tenants', async () => {
    const res = await repoA.findPaginated(
      staffListQuerySchema.parse({ page: 1, pageSize: 10, search: 'ana' }),
    );
    expect(res.items.map((s) => s.name)).toEqual(['Ana A']);
    expect(res.total).toBe(1);
  });

  it('findById does not return another tenant row', async () => {
    expect(await repoA.findById(staffB)).toBeUndefined();
    expect((await repoA.findById(staffA))?.name).toBe('Ana A');
    expect((await repoB.findById(staffB))?.name).toBe('Ana B');
  });

  it('create stamps the repository tenant', async () => {
    const created = await repoA.create({ name: 'New A', isActive: true });
    const rows = await testDb.select({ id: staff.id, tenantId: staff.tenantId }).from(staff);
    expect(rows.find((r) => r.id === created.id)?.tenantId).toBe(a.id);
  });

  it('updateById cannot modify another tenant row', async () => {
    expect(await repoA.updateById(staffB, { name: 'Hacked', isActive: true })).toBeUndefined();
    const page = await repoB.findPaginated(listAll);
    expect(page.items.map((s) => s.name)).toContain('Ana B');
  });

  it('deleteById cannot delete another tenant row', async () => {
    expect(await repoA.deleteById(staffB)).toBeUndefined();
    expect((await repoB.findPaginated(listAll)).items).toHaveLength(2);
    expect(await repoA.deleteById(staffA)).toEqual({ id: staffA });
  });

  it('deleting staff assigned to an event is STAFF_IN_USE and keeps the row', async () => {
    await assign(staffA, { quote: a, event: a, eventStaff: a });
    await expect(new StaffService(repoA).remove(staffA)).rejects.toMatchObject({
      code: 'CONFLICT',
      cause: { code: 'STAFF_IN_USE' },
    });
    expect(await repoA.findById(staffA)).toBeDefined();
  });

  it('an assigned staff member of another tenant stays NOT_FOUND, never IN_USE', async () => {
    await assign(staffB, { quote: b, event: b, eventStaff: b });
    await expect(new StaffService(repoA).remove(staffB)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'STAFF_NOT_FOUND' },
    });
    expect(await repoB.findById(staffB)).toBeDefined();
  });

  it('findAvailable lists only the tenant staff', async () => {
    const res = await repoA.findAvailable(DATE);
    expect(res.map((s) => s.id)).toEqual([staffA]);
  });

  it('findAvailable excludes staff busy in the same tenant', async () => {
    await assign(staffA, { quote: a, event: a, eventStaff: a });
    expect(await repoA.findAvailable(DATE)).toEqual([]);
  });

  it('findAvailable ignores event_staff rows of another tenant', async () => {
    await assign(staffA, { quote: a, event: a, eventStaff: b });
    expect((await repoA.findAvailable(DATE)).map((s) => s.id)).toEqual([staffA]);
  });

  it('findAvailable ignores events of another tenant', async () => {
    await assign(staffA, { quote: a, event: b, eventStaff: a });
    expect((await repoA.findAvailable(DATE)).map((s) => s.id)).toEqual([staffA]);
  });

  it('findAvailable ignores quotes of another tenant', async () => {
    await assign(staffA, { quote: b, event: a, eventStaff: a });
    expect((await repoA.findAvailable(DATE)).map((s) => s.id)).toEqual([staffA]);
  });
});
