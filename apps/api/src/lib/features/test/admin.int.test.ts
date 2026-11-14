import { drizzle } from 'drizzle-orm/postgres-js';
import { asc, eq } from 'drizzle-orm';
import postgres from 'postgres';
import { TRPCError } from '@trpc/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../../db/schema';
import { tenantFeatureEvents, tenantFeatures } from '../../../db/schema';
import type { Database } from '../../../db';
import { createTestTenant, resetDb } from '../../../test/db';
import { testPlatformDatabaseUrl } from '../../../test/roles';
import { AppError, ErrorCodes } from '../../errors';
import { listFeatures, setFeature, unsetFeature } from '../admin';

let client: ReturnType<typeof postgres>;
let platform: Database;
let tenantId: string;

beforeAll(() => {
  client = postgres(testPlatformDatabaseUrl(), { max: 4, onnotice: () => {} });
  platform = drizzle(client, { schema }) as unknown as Database;
});

afterAll(async () => {
  await client?.end();
  await resetDb();
});

beforeEach(async () => {
  await resetDb();
  tenantId = (await createTestTenant('acme', undefined, { features: [] })).id;
});

const ACTOR = 'tester';

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(TRPCError);
    const cause = (error as TRPCError).cause;
    expect(cause).toBeInstanceOf(AppError);
    return { code: (cause as AppError).code, message: (cause as AppError).message };
  }
  throw new Error('expected the call to fail');
}

const rowsOf = () =>
  platform.select().from(tenantFeatures).where(eq(tenantFeatures.tenantId, tenantId));
const eventsOf = () =>
  platform
    .select()
    .from(tenantFeatureEvents)
    .where(eq(tenantFeatureEvents.tenantId, tenantId))
    .orderBy(asc(tenantFeatureEvents.createdAt));

describe('setFeature', () => {
  it('enables a feature and records an enabled event with the actor', async () => {
    const row = await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    expect(row).toMatchObject({ featureKey: 'quotes', enabled: true, expiresAt: null });

    const events = await eventsOf();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tenantId,
      featureKey: 'quotes',
      action: 'enabled',
      before: null,
      actor: ACTOR,
    });
    expect(events[0]!.after).toMatchObject({ enabled: true });
  });

  it('stores expiry, price, period and currency', async () => {
    const expiresAt = new Date('2027-07-01T00:00:00Z');
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'priceTiers',
      expiresAt,
      priceCents: 1999,
      billingPeriod: 'monthly',
      currency: 'USD',
      actor: ACTOR,
    });
    const [row] = await rowsOf();
    expect(row).toMatchObject({
      expiresAt,
      priceCents: 1999,
      billingPeriod: 'monthly',
      currency: 'USD',
    });
  });

  it('records updated with before and after when the row already exists', async () => {
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      priceCents: 100,
      actor: 'first',
    });
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      priceCents: 250,
      actor: ACTOR,
    });

    const [row] = await rowsOf();
    expect(row).toMatchObject({ enabled: true, priceCents: 250 });
    const events = await eventsOf();
    expect(events.map((e) => e.action)).toEqual(['enabled', 'updated']);
    expect(events[1]).toMatchObject({ actor: ACTOR });
    expect(events[1]!.before).toMatchObject({ priceCents: 100 });
    expect(events[1]!.after).toMatchObject({ priceCents: 250 });
  });

  it('keeps omitted fields on update and clears them with null', async () => {
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      expiresAt: new Date('2027-07-01T00:00:00Z'),
      priceCents: 100,
      actor: ACTOR,
    });
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      billingPeriod: 'yearly',
      actor: ACTOR,
    });
    expect((await rowsOf())[0]).toMatchObject({
      expiresAt: new Date('2027-07-01T00:00:00Z'),
      priceCents: 100,
      billingPeriod: 'yearly',
    });
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      expiresAt: null,
      priceCents: null,
      actor: ACTOR,
    });
    expect((await rowsOf())[0]).toMatchObject({ expiresAt: null, priceCents: null });
  });

  it('re-enables a disabled feature as an enabled event', async () => {
    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    expect((await eventsOf()).map((e) => e.action)).toEqual(['enabled', 'disabled', 'enabled']);
    expect((await rowsOf())[0]!.enabled).toBe(true);
  });

  it('rejects an unknown key', async () => {
    const failure = await codeOf(
      setFeature(platform, { tenantSlug: 'acme', key: 'nope', actor: ACTOR }),
    );
    expect(failure.code).toBe(ErrorCodes.feature.UNKNOWN_KEY);
    expect(await rowsOf()).toEqual([]);
  });

  it('rejects a core feature', async () => {
    const failure = await codeOf(
      setFeature(platform, { tenantSlug: 'acme', key: 'clients', actor: ACTOR }),
    );
    expect(failure.code).toBe(ErrorCodes.feature.NOT_TOGGLEABLE);
    expect(await rowsOf()).toEqual([]);
    expect(await eventsOf()).toEqual([]);
  });

  it('rejects events when quotes is not active, naming the requirement', async () => {
    const failure = await codeOf(
      setFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR }),
    );
    expect(failure.code).toBe(ErrorCodes.feature.MISSING_DEPENDENCY);
    expect(failure.message).toContain('quotes');
    expect(await rowsOf()).toEqual([]);
  });

  it('treats a disabled or expired requirement as not active', async () => {
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      expiresAt: new Date('2000-01-01T00:00:00Z'),
      actor: ACTOR,
    });
    expect(
      (await codeOf(setFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR })))
        .code,
    ).toBe(ErrorCodes.feature.MISSING_DEPENDENCY);

    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      expiresAt: null,
      actor: ACTOR,
    });
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    expect(
      (await codeOf(setFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR })))
        .code,
    ).toBe(ErrorCodes.feature.MISSING_DEPENDENCY);
  });

  it('enables events once quotes is active', async () => {
    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    await setFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR });
    expect((await rowsOf()).map((r) => r.featureKey).sort()).toEqual(['events', 'quotes']);
  });

  it('fails for a tenant that does not exist', async () => {
    const failure = await codeOf(
      setFeature(platform, { tenantSlug: 'ghost', key: 'quotes', actor: ACTOR }),
    );
    expect(failure.code).toBe(ErrorCodes.tenant.NOT_FOUND);
  });

  it('only touches the named tenant', async () => {
    const other = await createTestTenant('other', undefined, { features: [] });
    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    const rows = await platform
      .select()
      .from(tenantFeatures)
      .where(eq(tenantFeatures.tenantId, other.id));
    expect(rows).toEqual([]);
  });
});

describe('unsetFeature', () => {
  it('leaves the row disabled, keeps price and dates, and records disabled', async () => {
    const expiresAt = new Date('2027-07-01T00:00:00Z');
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'priceTiers',
      expiresAt,
      priceCents: 500,
      billingPeriod: 'monthly',
      currency: 'USD',
      actor: 'first',
    });
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'priceTiers', actor: ACTOR });

    const [row] = await rowsOf();
    expect(row).toMatchObject({
      enabled: false,
      expiresAt,
      priceCents: 500,
      billingPeriod: 'monthly',
      currency: 'USD',
    });
    const events = await eventsOf();
    expect(events.at(-1)).toMatchObject({ action: 'disabled', actor: ACTOR });
    expect(events.at(-1)!.before).toMatchObject({ enabled: true });
    expect(events.at(-1)!.after).toMatchObject({ enabled: false });
  });

  it('refuses to disable quotes while events is active, naming events', async () => {
    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    await setFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR });
    const failure = await codeOf(
      unsetFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR }),
    );
    expect(failure.code).toBe(ErrorCodes.feature.HAS_DEPENDENTS);
    expect(failure.message).toContain('events');
    expect((await rowsOf()).find((r) => r.featureKey === 'quotes')!.enabled).toBe(true);
    expect(await eventsOf()).toHaveLength(2);
  });

  it('allows disabling quotes once events is disabled', async () => {
    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    await setFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR });
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR });
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    expect((await rowsOf()).every((r) => !r.enabled)).toBe(true);
  });

  it('fails for a feature that was never set', async () => {
    const failure = await codeOf(
      unsetFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR }),
    );
    expect(failure.code).toBe(ErrorCodes.feature.NOT_ENABLED);
  });

  it('rejects unknown and core keys and unknown tenants', async () => {
    expect(
      (await codeOf(unsetFeature(platform, { tenantSlug: 'acme', key: 'nope', actor: ACTOR })))
        .code,
    ).toBe(ErrorCodes.feature.UNKNOWN_KEY);
    expect(
      (await codeOf(unsetFeature(platform, { tenantSlug: 'acme', key: 'users', actor: ACTOR })))
        .code,
    ).toBe(ErrorCodes.feature.NOT_TOGGLEABLE);
    expect(
      (await codeOf(unsetFeature(platform, { tenantSlug: 'ghost', key: 'quotes', actor: ACTOR })))
        .code,
    ).toBe(ErrorCodes.tenant.NOT_FOUND);
  });
});

describe('dependents guard uses the stored state of the dependents', () => {
  const enableBoth = async () => {
    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    await setFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR });
  };
  // Reaches the state that natural expiry produces, which the service itself refuses to create.
  const expireQuotes = () =>
    client`UPDATE tenant_features SET expires_at = '2000-01-01'
           WHERE tenant_id = ${tenantId} AND feature_key = 'quotes'`;

  it('refuses to unset an already expired quotes while a stored-live events exists', async () => {
    await enableBoth();
    await expireQuotes();
    const failure = await codeOf(
      unsetFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR }),
    );
    expect(failure.code).toBe(ErrorCodes.feature.HAS_DEPENDENTS);
    expect(failure.message).toContain('events');
  });

  it('refuses a past expiry on quotes while events is live', async () => {
    await enableBoth();
    const failure = await codeOf(
      setFeature(platform, {
        tenantSlug: 'acme',
        key: 'quotes',
        expiresAt: new Date('2000-01-01T00:00:00Z'),
        actor: ACTOR,
      }),
    );
    expect(failure.code).toBe(ErrorCodes.feature.HAS_DEPENDENTS);
    expect(failure.message).toContain('events');
    expect((await rowsOf()).find((r) => r.featureKey === 'quotes')!.expiresAt).toBeNull();
  });

  it('accepts a future expiry on quotes while events is live', async () => {
    await enableBoth();
    const expiresAt = new Date(Date.now() + 86_400_000);
    const row = await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      expiresAt,
      actor: ACTOR,
    });
    expect(row.expiresAt).toEqual(expiresAt);
  });

  it('lets a past expiry on quotes through when events is not live', async () => {
    await enableBoth();
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR });
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'quotes',
      expiresAt: new Date('2000-01-01T00:00:00Z'),
      actor: ACTOR,
    });
    expect((await rowsOf()).find((r) => r.featureKey === 'quotes')!.expiresAt).not.toBeNull();
  });

  it('does not let a disabled or expired events row block unsetting quotes', async () => {
    await enableBoth();
    await client`UPDATE tenant_features SET expires_at = '2000-01-01'
                 WHERE tenant_id = ${tenantId} AND feature_key = 'events'`;
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    expect((await rowsOf()).find((r) => r.featureKey === 'quotes')!.enabled).toBe(false);

    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    await client`UPDATE tenant_features SET expires_at = NULL, enabled = false
                 WHERE tenant_id = ${tenantId} AND feature_key = 'events'`;
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    expect((await rowsOf()).find((r) => r.featureKey === 'quotes')!.enabled).toBe(false);
  });
});

describe('listFeatures', () => {
  it('lists the rows with their kind and whether each one is active now', async () => {
    await setFeature(platform, { tenantSlug: 'acme', key: 'quotes', actor: ACTOR });
    await setFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR });
    await setFeature(platform, {
      tenantSlug: 'acme',
      key: 'priceTiers',
      expiresAt: new Date('2000-01-01T00:00:00Z'),
      actor: ACTOR,
    });
    await unsetFeature(platform, { tenantSlug: 'acme', key: 'events', actor: ACTOR });

    const list = await listFeatures(platform, 'acme');
    expect(list.map((r) => [r.featureKey, r.kind, r.active])).toEqual([
      ['events', 'module', false],
      ['priceTiers', 'addon', false],
      ['quotes', 'module', true],
    ]);
  });

  it('returns an empty list for a tenant without features and fails for an unknown one', async () => {
    expect(await listFeatures(platform, 'acme')).toEqual([]);
    expect((await codeOf(listFeatures(platform, 'ghost'))).code).toBe(ErrorCodes.tenant.NOT_FOUND);
  });
});
