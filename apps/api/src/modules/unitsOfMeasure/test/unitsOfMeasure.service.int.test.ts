import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { unitsOfMeasureListQuerySchema, type CreateUnitInput } from '@repo/schemas';
import {
  clients,
  products,
  quoteLines,
  quoteStages,
  quotes,
  unitsOfMeasure,
} from '../../../db/schema';
import { createTestTenant, resetDb, testDb, testUnitId } from '../../../test/db';
import { UnitsOfMeasureRepository } from '../unitsOfMeasure.repository';
import { UnitsOfMeasureService } from '../unitsOfMeasure.service';

const listAll = unitsOfMeasureListQuerySchema.parse({});

const bundle: CreateUnitInput = {
  name: 'Bandeja',
  pluralName: 'Bandejas',
  code: 'bdj',
  dimension: 'quantity',
  factor: '6',
};

async function insertProduct(tenantId: string, uomId: string, isActive = true) {
  const [row] = await testDb
    .insert(products)
    .values({ tenantId, name: `P ${Math.random()}`, uomId, isActive })
    .returning({ id: products.id });
  return row!.id;
}

// A unit that only a quote line references: the product it came from moved on to another unit.
async function insertLineOnlyUnit(tenantId: string, lineUnitId: string) {
  const productUnit = await testUnitId(tenantId, 'kg');
  const productId = await insertProduct(tenantId, productUnit, true);
  await testDb
    .insert(quoteStages)
    .values({ id: 1, label: 'stage 1', color: '#000000', sortOrder: 1 })
    .onConflictDoNothing();
  const [client] = await testDb
    .insert(clients)
    .values({ tenantId, name: 'Client' })
    .returning({ id: clients.id });
  const [quote] = await testDb
    .insert(quotes)
    .values({ tenantId, seq: 1, number: 'Q-1', clientId: client!.id, taxRate: 0 })
    .returning({ id: quotes.id });
  await testDb.insert(quoteLines).values({
    tenantId,
    quoteId: quote!.id,
    productId,
    uomId: lineUnitId,
    quantity: 1,
    subtotal: 100,
  });
}

const rejects = (promise: Promise<unknown>, code: string, errorCode: string) =>
  expect(promise).rejects.toMatchObject({ code, cause: { code: errorCode } });

describe('UnitsOfMeasureService', () => {
  let tenantId: string;
  let service: UnitsOfMeasureService;

  beforeEach(async () => {
    await resetDb();
    ({ id: tenantId } = await createTestTenant('uom-svc'));
    service = new UnitsOfMeasureService(new UnitsOfMeasureRepository(testDb, tenantId));
  });

  describe('list', () => {
    it('returns the system units flagged, with normalized factors and usage', async () => {
      await insertProduct(tenantId, await testUnitId(tenantId, 'h'));
      const { items } = await service.list(listAll);
      expect(items).toHaveLength(23);
      expect(items.find((u) => u.code === 'lb')).toMatchObject({
        name: 'Libra',
        pluralName: 'Libras',
        dimension: 'weight',
        factor: '453.59237',
        isBase: false,
        isSystem: true,
        isActive: true,
        isUsed: false,
      });
      expect(items.find((u) => u.code === 'h')?.isUsed).toBe(true);
    });

    it('filters by dimension and by active state', async () => {
      const time = await service.list(unitsOfMeasureListQuerySchema.parse({ dimension: 'time' }));
      expect(time.items.map((u) => u.code)).toEqual(['min', 'h', 'd', 'sem']);
      await service.disable(await testUnitId(tenantId, 'sem'));
      const active = await service.list(
        unitsOfMeasureListQuerySchema.parse({ dimension: 'time', isActive: true }),
      );
      expect(active.items.map((u) => u.code)).toEqual(['min', 'h', 'd']);
    });

    it('options lists only the active units', async () => {
      await service.disable(await testUnitId(tenantId, 'doc'));
      const options = await service.options();
      expect(options).toHaveLength(22);
      expect(options.map((u) => u.code)).not.toContain('doc');
    });
  });

  describe('create', () => {
    it('creates an own, non-base unit at the end of the list', async () => {
      const created = await service.create(bundle);
      expect(created).toMatchObject({
        ...bundle,
        isBase: false,
        isSystem: false,
        isActive: true,
        sortOrder: 23,
      });
    });

    it('never creates a base unit, even when asked to', async () => {
      const created = await service.create({ ...bundle, isBase: true } as CreateUnitInput);
      expect(created.isBase).toBe(false);
    });

    it('rejects a code already used in the organization, ignoring case', async () => {
      await rejects(service.create({ ...bundle, code: 'kg' }), 'CONFLICT', 'UNIT_CODE_TAKEN');
      await rejects(service.create({ ...bundle, code: 'KG' }), 'CONFLICT', 'UNIT_CODE_TAKEN');
    });

    it('maps the database unique violation to UNIT_CODE_TAKEN', async () => {
      const repo = new UnitsOfMeasureRepository(testDb, tenantId);
      // A concurrent insert that slips past the service lookup still hits the constraint.
      repo.findByCode = async () => undefined;
      await rejects(
        new UnitsOfMeasureService(repo).create({ ...bundle, code: 'kg' }),
        'CONFLICT',
        'UNIT_CODE_TAKEN',
      );
    });

    it('rejects a factor that is not positive', async () => {
      await rejects(
        service.create({ ...bundle, factor: '0' }),
        'BAD_REQUEST',
        'UNIT_INVALID_FACTOR',
      );
      await rejects(
        service.create({ ...bundle, factor: '-2' }),
        'BAD_REQUEST',
        'UNIT_INVALID_FACTOR',
      );
    });
  });

  describe('update', () => {
    it('renames a system unit', async () => {
      const id = await testUnitId(tenantId, 'pers');
      const updated = await service.update(id, {
        name: 'Invitado',
        pluralName: 'Invitados',
        code: 'pers',
        dimension: 'quantity',
        factor: '1.0000',
      });
      expect(updated).toMatchObject({ name: 'Invitado', pluralName: 'Invitados', factor: '1' });
    });

    it('does not change the dimension, factor or code of a system unit', async () => {
      const id = await testUnitId(tenantId, 'h');
      const hour = {
        name: 'Hora',
        pluralName: 'Horas',
        code: 'h',
        dimension: 'time',
        factor: '60',
      } as const;
      await rejects(
        service.update(id, { ...hour, factor: '61' }),
        'BAD_REQUEST',
        'UNIT_SYSTEM_IMMUTABLE',
      );
      await rejects(
        service.update(id, { ...hour, dimension: 'quantity' }),
        'BAD_REQUEST',
        'UNIT_SYSTEM_IMMUTABLE',
      );
      await rejects(
        service.update(id, { ...hour, code: 'hr' }),
        'BAD_REQUEST',
        'UNIT_SYSTEM_IMMUTABLE',
      );
    });

    it('keeps the base unit of a dimension at factor 1', async () => {
      const id = await testUnitId(tenantId, 'g');
      await rejects(
        service.update(id, {
          name: 'Gramo',
          pluralName: 'Gramos',
          code: 'g',
          dimension: 'weight',
          factor: '2',
        }),
        'BAD_REQUEST',
        'UNIT_INVALID_FACTOR',
      );
    });

    it('changes everything of an own unit that no product uses', async () => {
      const { id } = await service.create(bundle);
      const updated = await service.update(id, {
        name: 'Hora extra',
        pluralName: 'Horas extra',
        code: 'hx',
        dimension: 'time',
        factor: '90',
      });
      expect(updated).toMatchObject({ code: 'hx', dimension: 'time', factor: '90' });
    });

    it('locks the dimension and factor of an own unit used by a product, active or not', async () => {
      const { id } = await service.create(bundle);
      await insertProduct(tenantId, id, false);
      await rejects(service.update(id, { ...bundle, factor: '12' }), 'CONFLICT', 'UNIT_IN_USE');
      await rejects(
        service.update(id, { ...bundle, dimension: 'weight' }),
        'CONFLICT',
        'UNIT_IN_USE',
      );
      await expect(
        service.update(id, { ...bundle, name: 'Charola', code: 'chr' }),
      ).resolves.toMatchObject({ name: 'Charola', code: 'chr', factor: '6' });
    });

    it('locks the dimension and factor of an own unit that only a quote line uses', async () => {
      const { id } = await service.create(bundle);
      await insertLineOnlyUnit(tenantId, id);
      await rejects(service.update(id, { ...bundle, factor: '12' }), 'CONFLICT', 'UNIT_IN_USE');
      const listed = (await service.list(listAll)).items.find((u) => u.id === id);
      expect(listed?.isUsed).toBe(true);
    });

    it('rejects a code taken by another unit, but keeps its own', async () => {
      const { id } = await service.create(bundle);
      await rejects(service.update(id, { ...bundle, code: 'Doc' }), 'CONFLICT', 'UNIT_CODE_TAKEN');
      await expect(service.update(id, { ...bundle, code: 'BDJ' })).resolves.toMatchObject({
        code: 'BDJ',
      });
    });

    it('answers NOT_FOUND for an unknown unit', async () => {
      await rejects(
        service.update('00000000-0000-4000-8000-000000000000', bundle),
        'NOT_FOUND',
        'UNIT_NOT_FOUND',
      );
    });
  });

  describe('disable and enable', () => {
    it('deactivates and reactivates a system unit no active product uses', async () => {
      const id = await testUnitId(tenantId, 'gal');
      expect((await service.disable(id)).isActive).toBe(false);
      expect((await service.enable(id)).isActive).toBe(true);
    });

    it('refuses to deactivate a unit used by an active product', async () => {
      const id = await testUnitId(tenantId, 'pers');
      await insertProduct(tenantId, id, true);
      await rejects(service.disable(id), 'CONFLICT', 'UNIT_IN_USE');
      const [row] = await testDb
        .select({ isActive: unitsOfMeasure.isActive })
        .from(unitsOfMeasure)
        .where(and(eq(unitsOfMeasure.id, id), eq(unitsOfMeasure.tenantId, tenantId)));
      expect(row!.isActive).toBe(true);
    });

    it('deactivates a unit used only by inactive products', async () => {
      const id = await testUnitId(tenantId, 'serv');
      await insertProduct(tenantId, id, false);
      expect((await service.disable(id)).isActive).toBe(false);
    });

    it('refuses to deactivate a unit that only a quote line uses', async () => {
      const id = await testUnitId(tenantId, 'pers');
      await insertLineOnlyUnit(tenantId, id);
      await rejects(service.disable(id), 'CONFLICT', 'UNIT_IN_USE');
    });

    it('answers NOT_FOUND for an unknown unit', async () => {
      await rejects(
        service.disable('00000000-0000-4000-8000-000000000000'),
        'NOT_FOUND',
        'UNIT_NOT_FOUND',
      );
    });
  });
});
