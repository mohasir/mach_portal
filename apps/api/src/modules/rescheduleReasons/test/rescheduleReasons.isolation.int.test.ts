import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { rescheduleReasonsListQuerySchema } from '@repo/schemas';
import { rescheduleReasons } from '../../../db/schema';
import { seedTwoTenants, resetDb, testDb, type TestTenant } from '../../../test/db';
import { RescheduleReasonsRepository } from '../rescheduleReasons.repository';
import { RescheduleReasonsService } from '../rescheduleReasons.service';

const listAll = rescheduleReasonsListQuerySchema.parse({});

async function insertReason(tenant: TestTenant, name: string, sortOrder = 0) {
  const [row] = await testDb
    .insert(rescheduleReasons)
    .values({ tenantId: tenant.id, name, sortOrder })
    .returning({ id: rescheduleReasons.id });
  return row!.id;
}

describe('rescheduleReasons tenant isolation', () => {
  let a: TestTenant;
  let b: TestTenant;
  let repoA: RescheduleReasonsRepository;
  let repoB: RescheduleReasonsRepository;
  let reasonA: string;
  let reasonB: string;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    reasonA = await insertReason(a, 'Clima', 1);
    reasonB = await insertReason(b, 'Proveedor', 9);
    await insertReason(b, 'Salud', 4);
    repoA = new RescheduleReasonsRepository(testDb, a.id);
    repoB = new RescheduleReasonsRepository(testDb, b.id);
  });

  it('findPaginated lists and counts only the tenant rows', async () => {
    const resA = await repoA.findPaginated(listAll);
    expect(resA.items.map((r) => r.name)).toEqual(['Clima']);
    const resB = await repoB.findPaginated(listAll);
    expect(resB.items).toHaveLength(2);
    expect(resB.total).toBe(2);
  });

  it('findById does not return another tenant row', async () => {
    expect(await repoA.findById(reasonB)).toBeUndefined();
    expect((await repoA.findById(reasonA))?.name).toBe('Clima');
  });

  it('findByName does not see other tenant names', async () => {
    expect(await repoA.findByName('Proveedor')).toBeUndefined();
    expect(await repoA.findByName('Clima')).toEqual({ id: reasonA });
  });

  it('findByName with excludeId stays tenant scoped', async () => {
    expect(await repoA.findByName('Clima', reasonB)).toEqual({ id: reasonA });
    expect(await repoA.findByName('Proveedor', reasonA)).toBeUndefined();
  });

  it('getMaxSortOrder ignores other tenants', async () => {
    expect(await repoA.getMaxSortOrder()).toBe(1);
    expect(await repoB.getMaxSortOrder()).toBe(9);
  });

  it('getMaxSortOrder is -1 for a tenant without rows', async () => {
    await testDb.delete(rescheduleReasons).where(eqTenant(a.id));
    expect(await repoA.getMaxSortOrder()).toBe(-1);
  });

  it('create stamps the tenant and ignores a tenantId in the payload', async () => {
    const created = await repoA.create({
      name: 'Nuevo',
      requiresNote: false,
      sortOrder: 2,
      ...({ tenantId: b.id } as object),
    } as never);
    const all = await testDb.select().from(rescheduleReasons);
    expect(all.find((r) => r.id === created.id)?.tenantId).toBe(a.id);
  });

  it('updateById cannot touch another tenant row', async () => {
    expect(await repoA.updateById(reasonB, { name: 'Hack', requiresNote: true })).toBeUndefined();
    const all = await testDb.select().from(rescheduleReasons);
    expect(all.find((r) => r.id === reasonB)?.name).toBe('Proveedor');
  });

  it('setActive cannot touch another tenant row', async () => {
    expect(await repoA.setActive(reasonB, false)).toBeUndefined();
    const all = await testDb.select().from(rescheduleReasons);
    expect(all.find((r) => r.id === reasonB)?.isActive).toBe(true);
  });

  it('the same name in two tenants does not conflict', async () => {
    await expect(
      new RescheduleReasonsService(repoA).create({ name: 'Boda', requiresNote: false }),
    ).resolves.toBeDefined();
    await expect(
      new RescheduleReasonsService(repoB).create({ name: 'Boda', requiresNote: false }),
    ).resolves.toBeDefined();
  });

  it('a duplicate name within one tenant is still a conflict', async () => {
    await expect(
      new RescheduleReasonsService(repoA).create({ name: 'Clima', requiresNote: false }),
    ).rejects.toMatchObject({ code: 'CONFLICT', cause: { code: 'RESCHEDULE_REASON_NAME_TAKEN' } });
  });

  it('create sortOrder continues from the tenant max, not the global one', async () => {
    const created = await new RescheduleReasonsService(repoA).create({
      name: 'Otro',
      requiresNote: false,
    });
    expect(created.sortOrder).toBe(2);
  });
});

function eqTenant(tenantId: string) {
  return eq(rescheduleReasons.tenantId, tenantId);
}
