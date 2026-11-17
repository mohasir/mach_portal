import { beforeEach, describe, expect, it } from 'vitest';
import { chargeTypesListQuerySchema } from '@repo/schemas';
import { chargeTypes } from '../../../db/schema';
import { resetDb, seedTwoTenants, testDb, type TestTenant } from '../../../test/db';
import { ChargeTypesRepository } from '../chargeTypes.repository';
import { ChargeTypesService } from '../chargeTypes.service';

const listAll = chargeTypesListQuerySchema.parse({});
const nameTaken = { code: 'CONFLICT', cause: { code: 'CHARGE_TYPE_NAME_TAKEN' } };
const invalidValue = { code: 'BAD_REQUEST', cause: { code: 'CHARGE_TYPE_INVALID_VALUE' } };
const freight = { name: 'Flete', kind: 'fixed' as const, defaultValue: 2500 };
const card = { name: 'Tarjeta', kind: 'percent' as const, defaultValue: 0.03 };

describe('charge types', () => {
  let a: TestTenant;
  let b: TestTenant;
  let service: ChargeTypesService;
  let serviceB: ChargeTypesService;

  beforeEach(async () => {
    await resetDb();
    ({ a, b } = await seedTwoTenants());
    service = new ChargeTypesService(new ChargeTypesRepository(testDb, a.id));
    serviceB = new ChargeTypesService(new ChargeTypesRepository(testDb, b.id));
  });

  it('creates charge types at the end of the list, active', async () => {
    await service.create(freight);
    const created = await service.create(card);
    expect(created).toEqual({
      id: expect.any(String),
      name: 'Tarjeta',
      kind: 'percent',
      defaultValue: 0.03,
      isActive: true,
      sortOrder: 1,
    });
    const { items } = await service.list(listAll);
    expect(items.map((c) => c.name)).toEqual(['Flete', 'Tarjeta']);
  });

  it('keeps the name unique per organization regardless of case', async () => {
    const created = await service.create(freight);
    await expect(service.create({ ...card, name: 'FLETE' })).rejects.toMatchObject(nameTaken);
    const other = await service.create(card);
    await expect(service.update(other.id, { ...card, name: 'flete' })).rejects.toMatchObject(
      nameTaken,
    );
    await expect(service.update(created.id, { ...freight, name: 'flete' })).resolves.toMatchObject({
      name: 'flete',
    });
    await expect(serviceB.create(freight)).resolves.toMatchObject({ name: 'Flete' });
  });

  it('rejects a duplicate name at the database too', async () => {
    await service.create(freight);
    await expect(
      testDb
        .insert(chargeTypes)
        .values({ tenantId: a.id, name: 'FLETE', kind: 'fixed', defaultValue: 0 }),
    ).rejects.toThrow();
  });

  it('rejects a value outside the range of its kind', async () => {
    await expect(service.create({ ...card, defaultValue: 1.2 })).rejects.toMatchObject(
      invalidValue,
    );
    await expect(service.create({ ...card, defaultValue: 0 })).rejects.toMatchObject(invalidValue);
    await expect(service.create({ ...freight, defaultValue: -5 })).rejects.toMatchObject(
      invalidValue,
    );
    await expect(service.create({ ...freight, defaultValue: 10.5 })).rejects.toMatchObject(
      invalidValue,
    );
    const created = await service.create(freight);
    await expect(
      service.update(created.id, { ...freight, kind: 'percent', defaultValue: 2500 }),
    ).rejects.toMatchObject(invalidValue);
    expect(await testDb.select().from(chargeTypes)).toHaveLength(1);
  });

  it('changes the kind and value of a type', async () => {
    const created = await service.create(freight);
    await expect(
      service.update(created.id, { name: 'Flete', kind: 'percent', defaultValue: 0.1 }),
    ).resolves.toMatchObject({ kind: 'percent', defaultValue: 0.1 });
  });

  it('disables and enables a type, and offers only the active ones', async () => {
    const created = await service.create(freight);
    await service.create(card);
    await expect(service.disable(created.id)).resolves.toMatchObject({ isActive: false });
    expect((await service.options()).map((c) => c.name)).toEqual(['Tarjeta']);
    await expect(service.enable(created.id)).resolves.toMatchObject({ isActive: true });
  });

  it('filters the list by status and searches by name', async () => {
    const created = await service.create(freight);
    await service.create(card);
    await service.disable(created.id);
    const inactive = await service.list(chargeTypesListQuerySchema.parse({ isActive: false }));
    expect(inactive.items.map((c) => c.name)).toEqual(['Flete']);
    const found = await service.list(chargeTypesListQuerySchema.parse({ search: 'tarj' }));
    expect(found.items.map((c) => c.name)).toEqual(['Tarjeta']);
  });

  it('answers NOT_FOUND for unknown ids', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const notFound = { code: 'NOT_FOUND', cause: { code: 'CHARGE_TYPE_NOT_FOUND' } };
    await expect(service.update(missing, freight)).rejects.toMatchObject(notFound);
    await expect(service.disable(missing)).rejects.toMatchObject(notFound);
    await expect(service.enable(missing)).rejects.toMatchObject(notFound);
  });
});
