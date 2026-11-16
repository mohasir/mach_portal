import { asc, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeDecimal, SYSTEM_UNITS, UOM_DIMENSIONS } from '@repo/schemas';
import { unitsOfMeasure } from '../../schema';
import { createTestTenant, resetDb, testDb } from '../../../test/db';
import { seedUnitsOfMeasure } from '../unitsOfMeasure';

async function unitsOf(tenantId: string) {
  const rows = await testDb
    .select()
    .from(unitsOfMeasure)
    .where(eq(unitsOfMeasure.tenantId, tenantId))
    .orderBy(asc(unitsOfMeasure.sortOrder));
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    pluralName: r.pluralName,
    dimension: r.dimension,
    factor: normalizeDecimal(r.factor),
    isBase: r.isBase,
    isSystem: r.isSystem,
    isActive: r.isActive,
  }));
}

const expected = SYSTEM_UNITS.map((u) => ({ ...u, isSystem: true, isActive: true }));

describe('seedUnitsOfMeasure', () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('inserts the 23 system units with their exact factors', async () => {
    const tenant = await createTestTenant('uom-seed', 'uom-seed', { units: false });
    await seedUnitsOfMeasure(tenant.id, testDb);
    const rows = await unitsOf(tenant.id);
    expect(rows).toHaveLength(23);
    expect(rows).toEqual(expected);
  });

  it('gives each dimension exactly one base unit with factor 1', async () => {
    const tenant = await createTestTenant('uom-bases', 'uom-bases', { units: false });
    await seedUnitsOfMeasure(tenant.id, testDb);
    const bases = (await unitsOf(tenant.id)).filter((u) => u.isBase);
    expect(bases.map((b) => b.dimension).sort()).toEqual([...UOM_DIMENSIONS].sort());
    for (const base of bases) expect(base.factor).toBe('1');
  });

  it('is idempotent by code and keeps the tenant edits', async () => {
    const tenant = await createTestTenant('uom-idem', 'uom-idem', { units: false });
    await seedUnitsOfMeasure(tenant.id, testDb);
    await testDb
      .update(unitsOfMeasure)
      .set({ name: 'Invitado', pluralName: 'Invitados', isActive: false })
      .where(eq(unitsOfMeasure.code, 'pers'));
    await seedUnitsOfMeasure(tenant.id, testDb);
    const rows = await unitsOf(tenant.id);
    expect(rows).toHaveLength(23);
    expect(rows.find((r) => r.code === 'pers')).toMatchObject({
      name: 'Invitado',
      pluralName: 'Invitados',
      isActive: false,
    });
  });

  it('seeds every tenant on its own', async () => {
    const a = await createTestTenant('uom-a', 'uom-a', { units: false });
    const b = await createTestTenant('uom-b', 'uom-b', { units: false });
    await seedUnitsOfMeasure(a.id, testDb);
    expect(await unitsOf(b.id)).toEqual([]);
    await seedUnitsOfMeasure(b.id, testDb);
    expect(await unitsOf(b.id)).toEqual(expected);
  });

  it('is what createTestTenant seeds by default', async () => {
    const tenant = await createTestTenant('uom-default');
    expect(await unitsOf(tenant.id)).toEqual(expected);
  });
});
