import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS, RESOURCES, type FeatureKey } from '@repo/guards';
import {
  createQuoteSchema,
  eventsListQuerySchema,
  notificationsListQuerySchema,
  quotesListQuerySchema,
} from '@repo/schemas';
import { db, type Database } from '../../../db';
import * as schema from '../../../db/schema';
import { productPriceTiers, products, tenantFeatures } from '../../../db/schema';
import { addMember, createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { seedEventsTenant, seedQuoteStages, type EventsSeed } from '../../../test/fixtures/events';
import { TEST_APP_ROLE, testAppDatabaseUrl } from '../../../test/roles';
import { callerFor, testContext } from '../../../test/trpcCaller';
import {
  guardedProcedure,
  guardedProcedureAnyOf,
  guardedShortTxProcedure,
  protectedProcedure,
  router,
} from '../trpc';

const PAST = new Date('2000-01-01T00:00:00Z');

type Seeded = { tenant: { id: string; slug: string; userId: string }; seed: EventsSeed };

async function seedTenant(slug: string, features?: FeatureKey[]): Promise<Seeded> {
  const created = await createTestTenant(slug, slug, { features });
  const owner = await createTestUser();
  await addMember(owner.id, created.id, 'superadmin');
  const tenant = { ...created, userId: owner.id };
  return { tenant, seed: await seedEventsTenant(tenant, slug) };
}

const allBut = (...off: FeatureKey[]): FeatureKey[] =>
  (['quotes', 'events', 'notifications', 'priceTiers', 'configurableOptions'] as const).filter(
    (k) => !off.includes(k),
  );

// The domain code of a failed call, or 'ok'. Other failures (validation, domain rules) still prove
// the call got past the feature guard.
async function outcome(call: Promise<unknown>): Promise<string> {
  try {
    await call;
    return 'ok';
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause;
    return cause?.code ?? (err as { code?: string }).code ?? 'unknown';
  }
}

const NOT_ENABLED = 'FEATURE_NOT_ENABLED';

async function expectNotEnabled(call: Promise<unknown>, feature: FeatureKey) {
  await expect(call).rejects.toMatchObject({
    code: 'FORBIDDEN',
    cause: { code: NOT_ENABLED, status: 403, details: { feature } },
  });
}

beforeEach(async () => {
  await resetDb();
  await seedQuoteStages();
});

describe('module guard on the app router', () => {
  it('with quotes off, quotes.create is blocked and quotes.list still answers', async () => {
    const { tenant, seed } = await seedTenant('no-quotes', allBut('quotes'));
    const caller = callerFor(tenant, { id: tenant.userId });

    await expectNotEnabled(
      caller.quotes.create(createQuoteSchema.parse({ clientId: seed.clientId, isDraft: true })),
      'quotes',
    );
    const list = await caller.quotes.list(quotesListQuerySchema.parse({}));
    expect(list.items.length).toBeGreaterThan(0);
  });

  it('with quotes on, quotes.create goes through', async () => {
    const { tenant, seed } = await seedTenant('with-quotes');
    const caller = callerFor(tenant, { id: tenant.userId });
    expect(
      await outcome(
        caller.quotes.create(createQuoteSchema.parse({ clientId: seed.clientId, isDraft: true })),
      ),
    ).toBe('ok');
  });

  it('events stored active but quotes expired: event and payment mutations are blocked, reads are not', async () => {
    const { tenant, seed } = await seedTenant('quotes-expired', allBut('quotes'));
    await testDb
      .insert(tenantFeatures)
      .values({ tenantId: tenant.id, featureKey: 'quotes', expiresAt: PAST });
    const caller = callerFor(tenant, { id: tenant.userId });

    await expectNotEnabled(caller.events.markCompleted({ id: seed.eventId }), 'events');
    await expectNotEnabled(
      caller.events.removePayment({ eventId: seed.eventId, paymentId: seed.paymentId }),
      'events',
    );
    const list = await caller.events.list(eventsListQuerySchema.parse({}));
    expect(list.items.length).toBeGreaterThan(0);
  });

  it('with events on, an event mutation gets past the guard', async () => {
    const { tenant, seed } = await seedTenant('with-events');
    const caller = callerFor(tenant, { id: tenant.userId });
    expect(await outcome(caller.events.markCompleted({ id: seed.eventId }))).not.toBe(NOT_ENABLED);
  });
});

describe('add-on guards', () => {
  it('with priceTiers off, products.prices.update is blocked and prices.list works', async () => {
    const { tenant, seed } = await seedTenant('no-tiers', allBut('priceTiers'));
    const caller = callerFor(tenant, { id: tenant.userId });

    await expectNotEnabled(
      caller.products.prices.update({
        id: seed.productId,
        data: { tiers: [{ quantity: 20, price: 2000 }] },
      }),
      'priceTiers',
    );
    expect((await caller.products.prices.list()).length).toBeGreaterThan(0);
  });

  it('with priceTiers on, products.prices.update goes through', async () => {
    const { tenant, seed } = await seedTenant('with-tiers');
    const caller = callerFor(tenant, { id: tenant.userId });
    expect(
      await outcome(
        caller.products.prices.update({
          id: seed.productId,
          data: { tiers: [{ quantity: 20, price: 2000 }] },
        }),
      ),
    ).toBe('ok');
  });

  describe('tiers sent through the product form', () => {
    const tiersOf = (productId: string) =>
      testDb
        .select({ quantity: productPriceTiers.quantity, price: productPriceTiers.price })
        .from(productPriceTiers)
        .where(eq(productPriceTiers.productId, productId));
    const productNamed = (tenantId: string, name: string) =>
      testDb
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.name, name)));
    const form = (name: string, tiers: { quantity: number; price: number }[]) => ({
      name,
      isPremium: false,
      tiers,
    });

    it('with priceTiers off, create and update carrying tiers are blocked and write nothing', async () => {
      const { tenant, seed } = await seedTenant('form-off', allBut('priceTiers'));
      const caller = callerFor(tenant, { id: tenant.userId });

      await expectNotEnabled(
        caller.products.create(form('New menu', [{ quantity: 5, price: 500 }])),
        'priceTiers',
      );
      expect(await productNamed(tenant.id, 'New menu')).toEqual([]);

      await expectNotEnabled(
        caller.products.update({
          id: seed.productId,
          data: form('Renamed', [{ quantity: 5, price: 500 }]),
        }),
        'priceTiers',
      );
      expect(await productNamed(tenant.id, 'Renamed')).toEqual([]);
      expect(await tiersOf(seed.productId)).toEqual([{ quantity: 10, price: 1000 }]);
    });

    it('with priceTiers off, create and update without tiers leave the stored tiers alone', async () => {
      const { tenant, seed } = await seedTenant('form-off-empty', allBut('priceTiers'));
      const caller = callerFor(tenant, { id: tenant.userId });

      const created = await caller.products.create(form('Plain menu', []));
      expect(await tiersOf(created.id)).toEqual([]);

      await caller.products.update({ id: seed.productId, data: form('Renamed', []) });
      expect(await productNamed(tenant.id, 'Renamed')).toHaveLength(1);
      expect(await tiersOf(seed.productId)).toEqual([{ quantity: 10, price: 1000 }]);
    });

    it('with priceTiers on, the form replaces the tiers as before', async () => {
      const { tenant, seed } = await seedTenant('form-on');
      const caller = callerFor(tenant, { id: tenant.userId });

      const created = await caller.products.create(form('New menu', [{ quantity: 5, price: 500 }]));
      expect(await tiersOf(created.id)).toEqual([{ quantity: 5, price: 500 }]);

      await caller.products.update({ id: seed.productId, data: form('Renamed', []) });
      expect(await tiersOf(seed.productId)).toEqual([]);
    });
  });

  it('with configurableOptions off, group and option mutations are blocked and the catalog reads', async () => {
    const { tenant, seed } = await seedTenant('no-options', allBut('configurableOptions'));
    const caller = callerFor(tenant, { id: tenant.userId });

    await expectNotEnabled(
      caller.products.groups.create({
        productId: seed.productId,
        label: 'Drinks',
        selectionType: 'select',
      }),
      'configurableOptions',
    );
    await expectNotEnabled(
      caller.products.groups.disable({ id: seed.groupId }),
      'configurableOptions',
    );
    await expectNotEnabled(
      caller.products.options.create({ optionGroupId: seed.groupId, name: 'Mojito' }),
      'configurableOptions',
    );
    await expectNotEnabled(
      caller.products.options.delete({ id: seed.optionId }),
      'configurableOptions',
    );
    expect((await caller.products.catalog()).length).toBeGreaterThan(0);
  });

  it('with configurableOptions on, group and option mutations go through', async () => {
    const { tenant, seed } = await seedTenant('with-options');
    const caller = callerFor(tenant, { id: tenant.userId });
    expect(
      await outcome(
        caller.products.groups.create({
          productId: seed.productId,
          label: 'Drinks',
          selectionType: 'select',
        }),
      ),
    ).toBe('ok');
    expect(
      await outcome(
        caller.products.options.create({ optionGroupId: seed.groupId, name: 'Mojito' }),
      ),
    ).toBe('ok');
  });

  it('with configurableOptions off, events.updateSelections is blocked; on, it goes through', async () => {
    const off = await seedTenant('selections-off', allBut('configurableOptions'));
    const on = await seedTenant('selections-on');

    await expectNotEnabled(
      callerFor(off.tenant, { id: off.tenant.userId }).events.updateSelections({
        eventId: off.seed.eventId,
        selections: [],
      }),
      'configurableOptions',
    );
    expect(
      await outcome(
        callerFor(on.tenant, { id: on.tenant.userId }).events.updateSelections({
          eventId: on.seed.eventId,
          selections: [],
        }),
      ),
    ).toBe('ok');
  });

  it('with notifications off, notification mutations are blocked and the feed reads', async () => {
    const { tenant, seed } = await seedTenant('no-notifications', allBut('notifications'));
    const caller = callerFor(tenant, { id: tenant.userId });

    await expectNotEnabled(caller.notifications.markAllRead(), 'notifications');
    await expectNotEnabled(caller.notifications.dismiss({ id: seed.reminderId }), 'notifications');
    await caller.notifications.list(notificationsListQuerySchema.parse({}));
    await caller.notifications.unreadCount();
  });
});

describe('option selection settings without configurableOptions', () => {
  it('an event with an unchosen select group has no pending selections nor deadline', async () => {
    const off = await seedTenant('options-off', allBut('configurableOptions'));
    const on = await seedTenant('options-on');

    const offDetail = await callerFor(off.tenant, { id: off.tenant.userId }).events.getById({
      id: off.seed.eventId,
    });
    const onDetail = await callerFor(on.tenant, { id: on.tenant.userId }).events.getById({
      id: on.seed.eventId,
    });

    expect(onDetail.selectionsPending).toBe(true);
    expect(onDetail.selectionsDeadline).not.toBeNull();
    expect(offDetail.selectionsPending).toBe(false);
    expect(offDetail.selectionsDeadline).toBeNull();
  });
});

describe('guard variants', () => {
  const testRouter = router({
    quoteOrClient: guardedProcedureAnyOf(
      { [RESOURCES.QUOTE]: [ACTIONS.CREATE] },
      { [RESOURCES.CLIENT]: [ACTIONS.CREATE] },
    ).mutation(() => 'ok'),
    quoteOrEvent: guardedProcedureAnyOf(
      { [RESOURCES.QUOTE]: [ACTIONS.CREATE] },
      { [RESOURCES.EVENT]: [ACTIONS.UPDATE] },
    ).mutation(() => 'ok'),
    quoteOrEventQuery: guardedProcedureAnyOf(
      { [RESOURCES.QUOTE]: [ACTIONS.READ] },
      { [RESOURCES.EVENT]: [ACTIONS.READ] },
    ).query(() => 'ok'),
    shortTxMutation: guardedShortTxProcedure({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] }).mutation(
      () => 'ok',
    ),
    // A resource mapped to a module next to a core one: the inactive module still blocks.
    mixed: guardedProcedure({
      [RESOURCES.CLIENT]: [ACTIONS.CREATE],
      [RESOURCES.QUOTE]: [ACTIONS.CREATE],
    }).mutation(() => 'ok'),
  });

  it('guardedProcedureAnyOf blocks only when every satisfied check belongs to an inactive module', async () => {
    const { tenant } = await seedTenant('anyof', allBut('quotes'));
    const caller = testRouter.createCaller(testContext(tenant, { id: tenant.userId }));

    expect(await caller.quoteOrClient()).toBe('ok');
    await expectNotEnabled(caller.quoteOrEvent(), 'quotes');
    expect(await caller.quoteOrEventQuery()).toBe('ok');
  });

  it('a check mixing a core resource and an inactive module is blocked', async () => {
    const { tenant } = await seedTenant('mixed', allBut('quotes'));
    const caller = testRouter.createCaller(testContext(tenant, { id: tenant.userId }));
    await expectNotEnabled(caller.mixed(), 'quotes');
  });

  it('guardedShortTxProcedure applies the module guard', async () => {
    const off = await seedTenant('short-off', allBut('quotes'));
    const on = await seedTenant('short-on');
    await expectNotEnabled(
      testRouter.createCaller(testContext(off.tenant, { id: off.tenant.userId })).shortTxMutation(),
      'quotes',
    );
    expect(
      await testRouter
        .createCaller(testContext(on.tenant, { id: on.tenant.userId }))
        .shortTxMutation(),
    ).toBe('ok');
  });
});

describe('ctx.features on the app role (RLS)', () => {
  // One connection: loading the features on anything but the request transaction (or, in a
  // shortTx procedure, its own short transaction) would wait forever for a second one.
  let appClient: ReturnType<typeof postgres>;
  let appDb: Database;

  beforeAll(async () => {
    appClient = postgres(testAppDatabaseUrl(), { max: 1 });
    appDb = drizzle(appClient, { schema }) as unknown as Database;
    const [row] = await appDb.execute<{ who: string }>(sql`select current_user as who`);
    expect(row?.who).toBe(TEST_APP_ROLE);
  });

  afterAll(async () => {
    await appClient?.end();
  });

  afterEach(() => vi.restoreAllMocks());

  function withinMs<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`did not finish within ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function spyGlobalPool() {
    return (['select', 'insert', 'update', 'delete', 'execute', 'transaction'] as const).map(
      (method) => vi.spyOn(db, method),
    );
  }

  it('protectedProcedure reads the features of its tenant on the request transaction', async () => {
    const a = await seedTenant('rls-a', ['quotes']);
    await seedTenant('rls-b');
    const spies = spyGlobalPool();
    const ctx = testContext(a.tenant, { id: a.tenant.userId }, appDb);

    const features = await withinMs(testRouter().createCaller(ctx).features(), 10_000);

    // Under RLS the rows are only visible with the tenant set, so `quotes` proves the read ran
    // inside the tenant transaction; tenant B's other rows never show up.
    expect(features).toContain('quotes');
    expect(features).not.toContain('events');
    expect(features).not.toContain('configurableOptions');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('shortTxProcedure reads them through runInTenant', async () => {
    const a = await seedTenant('rls-short', ['notifications']);
    const spies = spyGlobalPool();
    const ctx = testContext(a.tenant, { id: a.tenant.userId }, appDb);

    const features = await withinMs(testRouter().createCaller(ctx).shortTxFeatures(), 10_000);

    expect(features).toContain('notifications');
    expect(features).not.toContain('quotes');
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  const testRouter = () =>
    router({
      features: protectedProcedure.query(({ ctx }) => [...ctx.features].sort()),
      shortTxFeatures: guardedShortTxProcedure({ [RESOURCES.CLIENT]: [ACTIONS.READ] }).query(
        ({ ctx }) => [...ctx.features].sort(),
      ),
    });
});
