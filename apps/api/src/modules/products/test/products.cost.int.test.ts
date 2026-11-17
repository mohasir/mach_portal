import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { products } from '../../../db/schema';
import { settleBackgroundTasks } from '../../../lib/background';
import {
  addMember,
  addMemberWithGrants,
  createTestTenant,
  createTestUser,
  resetDb,
  testDb,
  testUnitId,
} from '../../../test/db';
import { seedEventsTenant, seedQuoteStages, type EventsSeed } from '../../../test/fixtures/events';
import { callerFor } from '../../../test/trpcCaller';
import { ProductsRepository } from '../products.repository';
import { ProductsService } from '../products.service';

const pdfService = vi.hoisted(() => ({ generateQuotePdf: vi.fn() }));
vi.mock('../../../lib/pdfService/client', () => pdfService);

// Distinctive, so a leak shows up anywhere in a serialized payload.
const COST = 987_654;
const costForbidden = { code: 'FORBIDDEN', cause: { code: 'PRODUCT_COST_FORBIDDEN' } };

const hasCostKey = (value: unknown): boolean =>
  JSON.stringify(value).includes('"cost"') || JSON.stringify(value).includes(String(COST));

describe('product cost at the service', () => {
  let tenantId: string;
  let unit: string;
  const base = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    isPremium: false,
    tiers: [],
    uomId: unit,
    price: 100,
    ...extra,
  });
  const serviceWith = (read: boolean, update: boolean) =>
    new ProductsService(new ProductsRepository(testDb, tenantId), true, { read, update });
  const storedCost = async (id: string) =>
    (await testDb.select({ cost: products.cost }).from(products).where(eq(products.id, id)))[0]
      ?.cost;

  beforeEach(async () => {
    await resetDb();
    tenantId = (await createTestTenant('cost-a')).id;
    unit = await testUnitId(tenantId);
  });

  it('returns the cost in every product response to a caller who may read it', async () => {
    const service = serviceWith(true, true);
    const created = await service.createProduct(base('Bar', { cost: COST }));
    expect(created.cost).toBe(COST);
    expect((await service.updateProduct(created.id, base('Bar'))).cost).toBe(COST);
    expect((await service.duplicateProduct(created.id)).cost).toBe(COST);
    expect((await service.toggleProductActive(created.id, true)).cost).toBe(COST);
    expect((await service.updateProductTiers(created.id, [])).cost).toBe(COST);
    for (const list of [
      await service.list(),
      await service.catalog(true),
      await service.pricesList(),
    ]) {
      expect(list.find((p) => p.id === created.id)?.cost).toBe(COST);
    }
  });

  it('omits the cost from every product response without the read permission', async () => {
    const { id } = await serviceWith(true, true).createProduct(base('Bar', { cost: COST }));
    const service = serviceWith(false, true);
    const responses = [
      await service.updateProduct(id, base('Bar')),
      await service.duplicateProduct(id),
      await service.toggleProductActive(id, true),
      await service.updateProductTiers(id, []),
      await service.createProduct(base('Bar 3', { cost: 5 })),
      await service.list(),
      await service.catalog(true),
      await service.pricesList(),
    ];
    for (const response of responses) {
      expect(hasCostKey(response), JSON.stringify(response)).toBe(false);
    }
    expect(await storedCost(id)).toBe(COST);
  });

  it('rejects writing the cost without the update permission and writes nothing', async () => {
    const { id } = await serviceWith(true, true).createProduct(base('Bar', { cost: COST }));
    for (const service of [serviceWith(true, false), serviceWith(false, false)]) {
      await expect(service.createProduct(base('Nuevo', { cost: 1 }))).rejects.toMatchObject(
        costForbidden,
      );
      await expect(service.createProduct(base('Nuevo', { cost: null }))).rejects.toMatchObject(
        costForbidden,
      );
      await expect(
        service.updateProduct(id, base('Renombrado', { cost: 1 })),
      ).rejects.toMatchObject(costForbidden);
    }
    const rows = await testDb.select().from(products).where(eq(products.tenantId, tenantId));
    expect(rows.map((r) => [r.name, r.cost])).toEqual([['Bar', COST]]);
  });

  it('keeps the stored cost when an update without the permission omits it', async () => {
    const { id } = await serviceWith(true, true).createProduct(base('Bar', { cost: COST }));
    await serviceWith(false, false).updateProduct(id, base('Renombrado'));
    expect(await storedCost(id)).toBe(COST);
  });

  it('copies the cost when duplicating, also for a caller who cannot see it', async () => {
    const { id } = await serviceWith(true, true).createProduct(base('Bar', { cost: COST }));
    const copy = await serviceWith(false, false).duplicateProduct(id);
    expect(await storedCost(copy.id)).toBe(COST);
  });
});

describe('product cost through the API', () => {
  let tenant: { id: string; slug: string };
  let seed: EventsSeed;
  let ownerId: string;

  const memberWith = async (grants: [string, string][]) => {
    const user = await createTestUser();
    await addMemberWithGrants(
      user.id,
      tenant.id,
      grants.map(([resource, action]) => [resource, action, 'all'] as const),
    );
    return callerFor(tenant, user);
  };

  beforeEach(async () => {
    await resetDb();
    await seedQuoteStages();
    tenant = await createTestTenant('cost-api');
    const owner = await createTestUser();
    await addMember(owner.id, tenant.id, 'superadmin');
    ownerId = owner.id;
    seed = await seedEventsTenant({ ...tenant, userId: owner.id }, 'A');
    await testDb.execute(sql`UPDATE products SET cost = ${COST} WHERE tenant_id = ${tenant.id}`);
    pdfService.generateQuotePdf.mockReset();
    pdfService.generateQuotePdf.mockResolvedValue({ url: 'http://pdf/x.pdf', key: 'x.pdf' });
  });

  afterEach(async () => {
    await settleBackgroundTasks();
  });

  it('shows the cost to a role with product_cost.read', async () => {
    const caller = await memberWith([
      ['product', 'read'],
      ['product_cost', 'read'],
    ]);
    expect((await caller.products.list())[0]?.cost).toBe(COST);
    expect((await caller.products.catalog())[0]?.cost).toBe(COST);
    expect((await caller.products.prices.list())[0]?.cost).toBe(COST);
  });

  it('omits the cost for a role without product_cost.read', async () => {
    const caller = await memberWith([['product', 'read']]);
    for (const response of [
      await caller.products.list(),
      await caller.products.catalog(),
      await caller.products.prices.list(),
    ]) {
      expect(response.length).toBeGreaterThan(0);
      expect(hasCostKey(response)).toBe(false);
    }
  });

  it('rejects writing the cost without product_cost.update and writes nothing', async () => {
    const caller = await memberWith([
      ['product', 'create'],
      ['product', 'update'],
      ['product_cost', 'read'],
    ]);
    const uomId = await testUnitId(tenant.id);
    const input = { name: 'Nuevo', isPremium: false, tiers: [], uomId, price: 10, cost: 5 };
    await expect(caller.products.create(input)).rejects.toMatchObject(costForbidden);
    await expect(
      caller.products.update({ id: seed.productId, data: { ...input, name: 'Renombrado' } }),
    ).rejects.toMatchObject(costForbidden);
    const rows = await testDb.select().from(products).where(eq(products.tenantId, tenant.id));
    expect(rows.map((r) => r.name)).not.toContain('Nuevo');
    expect(rows.find((r) => r.id === seed.productId)?.cost).toBe(COST);
  });

  it('never puts the cost in quote, event, dashboard or PDF payloads, even for the owner', async () => {
    const owner = callerFor(tenant, { id: ownerId });
    expect((await owner.products.list())[0]?.cost).toBe(COST);

    const payloads = [
      await owner.quotes.getById({ id: seed.quoteId }),
      await owner.quotes.list({}),
      await owner.quotes.board({}),
      await owner.events.getById({ id: seed.eventId }),
      await owner.events.list({ segment: 'all' }),
      await owner.events.calendar({ month: 6, year: 2030 }),
      await owner.dashboard.topProducts({ month: 6, year: 2030 }),
      await owner.dashboard.summary({ month: 6, year: 2030 }),
    ];
    for (const payload of payloads) {
      expect(hasCostKey(payload), JSON.stringify(payload).slice(0, 300)).toBe(false);
    }

    await owner.quotes.generatePdf({ id: seed.quoteId });
    expect(pdfService.generateQuotePdf).toHaveBeenCalledOnce();
    expect(hasCostKey(pdfService.generateQuotePdf.mock.calls[0]![0])).toBe(false);
  });
});
