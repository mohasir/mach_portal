import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clients,
  events,
  platformAccessLog,
  platformAuditLog,
  products,
  quoteStages,
  quotes,
  tenantFeatureEvents,
  tenantFeatures,
} from '../../../db/schema';
import { createUserWithPassword } from '../../../test/authHelpers';
import {
  addMember,
  createTestTenant,
  createTestUser,
  resetDb,
  testDb,
  testUnitId,
} from '../../../test/db';
import { consoleCallerFor } from '../../../test/trpcCaller';

let adminId: string;
let admin: ReturnType<typeof consoleCallerFor>;

beforeEach(async () => {
  await resetDb();
  adminId = await createUserWithPassword('platform@example.com', { isPlatformAdmin: true });
  admin = consoleCallerFor({ id: adminId });
});
afterAll(resetDb);

const DAY = 86_400_000;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs);

async function seedStages() {
  await testDb
    .insert(quoteStages)
    .values([
      { id: 1, label: 'Pending', color: '#000000', sortOrder: 1 },
      { id: 2, label: 'Sent', color: '#000000', sortOrder: 2 },
      { id: 3, label: 'Won', color: '#000000', sortOrder: 0 },
    ])
    .onConflictDoNothing();
}

async function seedData(
  tenantId: string,
  counts: { products: number; clients: number; quoteStages: number[]; events: number },
) {
  await seedStages();
  const uomId = await testUnitId(tenantId);
  for (let i = 0; i < counts.products; i++) {
    await testDb.insert(products).values({ tenantId, name: `P${i}`, uomId, taxRate: 0 });
  }
  const [client] = await testDb
    .insert(clients)
    .values(
      Array.from({ length: Math.max(counts.clients, 1) }, (_, i) => ({ tenantId, name: `C${i}` })),
    )
    .returning();
  if (counts.clients === 0)
    await testDb.execute(sql`DELETE FROM clients WHERE tenant_id = ${tenantId}`);
  const quoteRows = [];
  for (const [i, stageId] of counts.quoteStages.entries()) {
    const [q] = await testDb
      .insert(quotes)
      .values({ tenantId, seq: i + 1, number: `Q-${tenantId}-${i}`, clientId: client!.id, stageId })
      .returning();
    quoteRows.push(q!);
  }
  for (let i = 0; i < counts.events; i++) {
    await testDb.insert(events).values({
      tenantId,
      quoteId: quoteRows[i]!.id,
      clientId: client!.id,
      totalAmount: 100,
    });
  }
}

describe('console.history.list', () => {
  it('merges feature events, platform access and console audit of one organization newest first', async () => {
    const org = await createTestTenant('hist-org', 'Hist');
    await testDb.insert(tenantFeatureEvents).values({
      tenantId: org.id,
      featureKey: 'quotes',
      action: 'enabled',
      before: null,
      after: { enabled: true },
      actor: 'ops@example.com',
      createdAt: at(-3 * 60_000),
    });
    await testDb.insert(platformAccessLog).values({
      userId: adminId,
      tenantId: org.id,
      path: 'products.list',
      type: 'query',
      createdAt: at(-2 * 60_000),
    });
    await testDb.insert(platformAuditLog).values({
      userId: adminId,
      tenantId: org.id,
      action: 'catalog.set',
      payload: { kind: 'generic' },
      createdAt: at(-1 * 60_000),
    });

    const items = await admin.console.history.list({ organizationId: org.id });

    expect(items.map((i) => [i.source, i.label])).toEqual([
      ['audit', 'audit.catalog.set'],
      ['access', 'access.query'],
      ['feature', 'feature.enabled'],
    ]);
    expect(items[0]).toMatchObject({
      actor: 'platform@example.com',
      detail: { kind: 'generic' },
    });
    expect(items[1]).toMatchObject({
      actor: 'platform@example.com',
      detail: { path: 'products.list' },
    });
    expect(items[2]).toMatchObject({
      actor: 'ops@example.com',
      detail: { featureKey: 'quotes', before: null, after: { enabled: true } },
    });
    expect(typeof items[0]!.createdAt).toBe('string');
  });

  it('does not include rows of another organization', async () => {
    const a = await createTestTenant('hist-a', 'A');
    const b = await createTestTenant('hist-b', 'B');
    await testDb.insert(platformAuditLog).values([
      { userId: adminId, tenantId: a.id, action: 'feature.set', payload: { key: 'quotes' } },
      { userId: adminId, tenantId: b.id, action: 'feature.unset', payload: { key: 'events' } },
      { userId: adminId, action: 'organization.create' },
    ]);
    await testDb.insert(platformAccessLog).values({
      userId: adminId,
      tenantId: b.id,
      path: 'x',
      type: 'mutation',
    });

    const items = await admin.console.history.list({ organizationId: a.id });
    expect(items.map((i) => i.label)).toEqual(['audit.feature.set']);
  });

  it('respects the limit', async () => {
    const org = await createTestTenant('lim-org', 'Lim');
    await testDb.insert(platformAccessLog).values(
      Array.from({ length: 5 }, (_, i) => ({
        userId: adminId,
        tenantId: org.id,
        path: `p${i}`,
        type: 'query' as const,
        createdAt: at(-i * 1000),
      })),
    );
    const items = await admin.console.history.list({ organizationId: org.id, limit: 3 });
    expect(items.map((i) => i.detail)).toEqual([{ path: 'p0' }, { path: 'p1' }, { path: 'p2' }]);
  });

  it('rejects an unknown organization and does not audit the read', async () => {
    await expect(
      admin.console.history.list({ organizationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const org = await createTestTenant('noaudit', 'No');
    await admin.console.history.list({ organizationId: org.id });
    expect(await testDb.select().from(platformAuditLog)).toHaveLength(0);
  });

  it('rejects a non platform admin', async () => {
    const org = await createTestTenant('forbid-h', 'F');
    const user = await createTestUser();
    await addMember(user.id, org.id);
    await expect(
      consoleCallerFor({ id: user.id }).console.history.list({ organizationId: org.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('console.summary', () => {
  it('global summary totals every organization and lists features expiring soon', async () => {
    const a = await createTestTenant('sum-a', 'Alpha', { features: [] });
    const b = await createTestTenant('sum-b', 'Beta', { features: [] });
    await seedData(a.id, { products: 2, clients: 1, quoteStages: [1, 2], events: 1 });
    await seedData(b.id, { products: 1, clients: 3, quoteStages: [1], events: 1 });
    const soon = at(10 * DAY);
    await testDb.insert(tenantFeatures).values([
      { tenantId: a.id, featureKey: 'quotes', expiresAt: at(20 * DAY) },
      { tenantId: b.id, featureKey: 'events', expiresAt: soon },
      { tenantId: b.id, featureKey: 'priceTiers', expiresAt: at(90 * DAY) },
      { tenantId: a.id, featureKey: 'productGallery', expiresAt: at(-DAY) },
      { tenantId: a.id, featureKey: 'unitsOfMeasure', expiresAt: at(5 * DAY), enabled: false },
      { tenantId: b.id, featureKey: 'extraCharges', expiresAt: null },
    ]);

    const summary = await admin.console.summary.global();

    expect(summary).toMatchObject({ organizations: 2, products: 3, quotes: 3, events: 2 });
    expect(summary.expiringFeatures).toEqual([
      {
        organizationId: b.id,
        organizationName: 'Beta',
        featureKey: 'events',
        expiresAt: soon.toISOString(),
      },
      {
        organizationId: a.id,
        organizationName: 'Alpha',
        featureKey: 'quotes',
        expiresAt: expect.any(String),
      },
    ]);
  });

  it('organization summary counts only that organization, quotes by status', async () => {
    const a = await createTestTenant('os-a', 'A');
    const b = await createTestTenant('os-b', 'B');
    await seedData(a.id, { products: 2, clients: 1, quoteStages: [1, 1, 2], events: 2 });
    await seedData(b.id, { products: 5, clients: 4, quoteStages: [2, 2, 2, 2], events: 3 });

    const summary = await admin.console.summary.organization({ organizationId: a.id });

    expect(summary).toEqual({
      products: 2,
      clients: 1,
      quotesByStage: [
        { stageId: 1, label: 'Pending', count: 2 },
        { stageId: 2, label: 'Sent', count: 1 },
      ],
      events: 2,
    });
  });

  it('orders quote stages by sort order and leaves out stages without quotes', async () => {
    const org = await createTestTenant('os-order', 'Order');
    await seedData(org.id, { products: 0, clients: 1, quoteStages: [2, 3, 3], events: 0 });
    const summary = await admin.console.summary.organization({ organizationId: org.id });
    expect(summary.quotesByStage).toEqual([
      { stageId: 3, label: 'Won', count: 2 },
      { stageId: 2, label: 'Sent', count: 1 },
    ]);
  });

  it('returns zeros for an organization without data', async () => {
    const org = await createTestTenant('empty', 'Empty', { units: false });
    expect(await admin.console.summary.organization({ organizationId: org.id })).toEqual({
      products: 0,
      clients: 0,
      quotesByStage: [],
      events: 0,
    });
  });

  it('rejects an unknown organization', async () => {
    await expect(
      admin.console.summary.organization({ organizationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a non platform admin', async () => {
    const user = await createTestUser();
    const caller = consoleCallerFor({ id: user.id });
    await expect(caller.console.summary.global()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      caller.console.summary.organization({ organizationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
