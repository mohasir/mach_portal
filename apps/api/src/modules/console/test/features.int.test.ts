import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FEATURE_KEYS, FEATURES, isToggleable, type FeatureKey } from '@repo/guards';
import { platformAuditLog, tenantFeatures, tenantProfile } from '../../../db/schema';
import { ErrorCodes } from '../../../lib/errors';
import { createUserWithPassword } from '../../../test/authHelpers';
import { addMember, createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { callerFor, consoleCallerFor } from '../../../test/trpcCaller';

let adminId: string;
let admin: ReturnType<typeof consoleCallerFor>;

beforeEach(async () => {
  await resetDb();
  adminId = await createUserWithPassword('platform@example.com', { isPlatformAdmin: true });
  admin = consoleCallerFor({ id: adminId });
});
afterAll(resetDb);

const audit = () => testDb.select().from(platformAuditLog);
const errorCode = (e: unknown) => (e as { cause?: { code?: string } }).cause?.code;
const storedRow = async (tenantId: string, key: FeatureKey) =>
  (
    await testDb
      .select()
      .from(tenantFeatures)
      .where(and(eq(tenantFeatures.tenantId, tenantId), eq(tenantFeatures.featureKey, key)))
  )[0];

describe('console.features.list', () => {
  it('lists every toggleable feature, off ones included', async () => {
    const org = await createTestTenant('list-org', 'List', { features: [] });
    await admin.console.features.set({
      organizationId: org.id,
      key: 'quotes',
      priceCents: 1500,
      billingPeriod: 'monthly',
      currency: 'USD',
    });

    const items = await admin.console.features.list({ organizationId: org.id });
    const expected = FEATURE_KEYS.filter(isToggleable);
    expect(items.map((f) => f.key)).toEqual(expected);
    expect(items.find((f) => f.key === 'quotes')).toMatchObject({
      kind: 'module',
      enabled: true,
      active: true,
      expiresAt: null,
      priceCents: 1500,
      billingPeriod: 'monthly',
      currency: 'USD',
    });
    expect(items.find((f) => f.key === 'priceTiers')).toEqual({
      key: 'priceTiers',
      kind: 'addon',
      enabled: false,
      active: false,
      activatedAt: null,
      expiresAt: null,
      priceCents: null,
      billingPeriod: null,
      currency: null,
    });
  });

  it('reports an enabled feature whose dependency is inactive as not active', async () => {
    const org = await createTestTenant('dep-org', 'Dep', { features: [] });
    await testDb.insert(tenantFeatures).values({ tenantId: org.id, featureKey: 'events' });
    const items = await admin.console.features.list({ organizationId: org.id });
    expect(items.find((f) => f.key === 'events')).toMatchObject({ enabled: true, active: false });
  });

  it('reports an expired feature as enabled but not active', async () => {
    const org = await createTestTenant('exp-org', 'Exp', { features: [] });
    await testDb.insert(tenantFeatures).values({
      tenantId: org.id,
      featureKey: 'quotes',
      expiresAt: new Date(Date.now() - 1000),
    });
    const items = await admin.console.features.list({ organizationId: org.id });
    expect(items.find((f) => f.key === 'quotes')).toMatchObject({ enabled: true, active: false });
  });
});

describe('console.features.set', () => {
  it('enables a feature with expiry and price, and audits feature.set', async () => {
    const org = await createTestTenant('set-org', 'Set', { features: [] });
    await admin.console.features.set({
      organizationId: org.id,
      key: 'quotes',
      expiresOn: '2099-06-30',
      priceCents: 2500,
      billingPeriod: 'yearly',
      currency: 'EUR',
    });

    const row = await storedRow(org.id, 'quotes');
    expect(row).toMatchObject({
      enabled: true,
      priceCents: 2500,
      billingPeriod: 'yearly',
      currency: 'EUR',
    });
    expect(row?.expiresAt?.toISOString()).toBe('2099-07-01T00:00:00.000Z');

    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: adminId,
      action: 'feature.set',
      tenantId: org.id,
      payload: {
        key: 'quotes',
        expiresAt: '2099-07-01T00:00:00.000Z',
        priceCents: 2500,
        billingPeriod: 'yearly',
        currency: 'EUR',
      },
    });
  });

  it('records the platform admin email as the actor of the feature event', async () => {
    const org = await createTestTenant('actor-org', 'Actor', { features: [] });
    await admin.console.features.set({ organizationId: org.id, key: 'quotes' });
    const result = await testDb.execute<{ actor: string }>(
      sql`SELECT actor FROM tenant_feature_events WHERE tenant_id = ${org.id}`,
    );
    expect(result.map((r) => r.actor)).toEqual(['platform@example.com']);
  });

  it('treats expiresOn as the last active day', async () => {
    const org = await createTestTenant('day-org', 'Day', { features: [] });
    await admin.console.features.set({
      organizationId: org.id,
      key: 'quotes',
      expiresOn: '2099-12-31',
    });
    expect((await storedRow(org.id, 'quotes'))?.expiresAt?.toISOString()).toBe(
      '2100-01-01T00:00:00.000Z',
    );
  });

  it('keeps stored values for absent fields and clears the ones set to null', async () => {
    const org = await createTestTenant('keep-org', 'Keep', { features: [] });
    await admin.console.features.set({
      organizationId: org.id,
      key: 'quotes',
      expiresOn: '2099-01-10',
      priceCents: 900,
      currency: 'USD',
    });
    await admin.console.features.set({ organizationId: org.id, key: 'quotes', priceCents: 1000 });
    expect(await storedRow(org.id, 'quotes')).toMatchObject({
      priceCents: 1000,
      currency: 'USD',
    });
    expect((await storedRow(org.id, 'quotes'))?.expiresAt).not.toBeNull();

    await admin.console.features.set({
      organizationId: org.id,
      key: 'quotes',
      expiresOn: null,
      currency: null,
    });
    expect(await storedRow(org.id, 'quotes')).toMatchObject({
      expiresAt: null,
      currency: null,
      priceCents: 1000,
    });
    const rows = await audit();
    expect(rows.at(-1)?.payload).toMatchObject({
      key: 'quotes',
      expiresAt: null,
      priceCents: 1000,
      currency: null,
    });
  });

  it('rejects a malformed or impossible expiresOn as a bad request', async () => {
    const org = await createTestTenant('bad-date', 'Bad', { features: [] });
    for (const expiresOn of ['2099-02-30', '2099-1-1', 'tomorrow', '']) {
      await expect(
        admin.console.features.set({ organizationId: org.id, key: 'quotes', expiresOn }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    }
    expect(await audit()).toHaveLength(0);
    expect(await storedRow(org.id, 'quotes')).toBeUndefined();
  });

  it('rejects a feature whose dependency is inactive with MISSING_DEPENDENCY', async () => {
    const org = await createTestTenant('missing-dep', 'Dep', { features: [] });
    const err = await admin.console.features
      .set({ organizationId: org.id, key: 'events' })
      .catch((e) => e);
    expect(err).toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(errorCode(err)).toBe(ErrorCodes.feature.MISSING_DEPENDENCY);
    expect(await audit()).toHaveLength(0);
  });

  it('rejects disabling quotes while events is active with HAS_DEPENDENTS', async () => {
    const org = await createTestTenant('has-dep', 'HasDep', { features: ['quotes', 'events'] });
    const err = await admin.console.features
      .unset({ organizationId: org.id, key: 'quotes' })
      .catch((e) => e);
    expect(err).toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(errorCode(err)).toBe(ErrorCodes.feature.HAS_DEPENDENTS);
    expect((await storedRow(org.id, 'quotes'))?.enabled).toBe(true);
    expect(await audit()).toHaveLength(0);
  });

  it('rejects a core or unknown key', async () => {
    const org = await createTestTenant('core-org', 'Core', { features: [] });
    const core = FEATURE_KEYS.find((k) => FEATURES[k].kind === 'core')!;
    const coreErr = await admin.console.features
      .set({ organizationId: org.id, key: core })
      .catch((e) => e);
    expect(coreErr).toMatchObject({ code: 'BAD_REQUEST' });
    expect(errorCode(coreErr)).toBe(ErrorCodes.feature.NOT_TOGGLEABLE);

    await expect(
      admin.console.features.set({ organizationId: org.id, key: 'nope' as never }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await audit()).toHaveLength(0);
  });
});

describe('console.features.unset', () => {
  it('unset disables the feature and audits feature.unset', async () => {
    const org = await createTestTenant('unset-org', 'Unset', { features: ['quotes'] });
    await admin.console.features.unset({ organizationId: org.id, key: 'quotes' });

    expect((await storedRow(org.id, 'quotes'))?.enabled).toBe(false);
    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: adminId,
      action: 'feature.unset',
      tenantId: org.id,
      payload: { key: 'quotes' },
    });
  });

  it('rejects a feature that was never enabled', async () => {
    const org = await createTestTenant('never-org', 'Never', { features: [] });
    const err = await admin.console.features
      .unset({ organizationId: org.id, key: 'quotes' })
      .catch((e) => e);
    expect(err).toMatchObject({ code: 'NOT_FOUND' });
    expect(errorCode(err)).toBe(ErrorCodes.feature.NOT_ENABLED);
    expect(await audit()).toHaveLength(0);
  });
});

describe('feature cache and atomicity', () => {
  it('clears the feature cache so the tenant sees the change on its next request', async () => {
    const org = await createTestTenant('cache-org', 'Cache', { features: [] });
    const member = await createTestUser();
    await addMember(member.id, org.id, 'superadmin');
    const tenant = callerFor(org, member);

    const keys = async () => (await tenant.features.mine()).features.map((f) => f.key);
    expect(await keys()).not.toContain('quotes');

    await admin.console.features.set({ organizationId: org.id, key: 'quotes' });
    expect(await keys()).toContain('quotes');

    await admin.console.features.unset({ organizationId: org.id, key: 'quotes' });
    expect(await keys()).not.toContain('quotes');
  });

  it('rolls back the change when the audit write fails', async () => {
    const org = await createTestTenant('rollback-org', 'Rollback', { features: [] });
    await testDb.execute(
      sql`ALTER TABLE platform_audit_log ADD CONSTRAINT test_reject_audit CHECK (false)`,
    );
    try {
      await expect(
        admin.console.features.set({ organizationId: org.id, key: 'quotes', priceCents: 100 }),
      ).rejects.toBeDefined();
      expect(await storedRow(org.id, 'quotes')).toBeUndefined();
      const events = await testDb.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM tenant_feature_events WHERE tenant_id = ${org.id}`,
      );
      expect(events[0]?.n).toBe(0);

      await testDb.insert(tenantFeatures).values({ tenantId: org.id, featureKey: 'quotes' });
      await expect(
        admin.console.features.unset({ organizationId: org.id, key: 'quotes' }),
      ).rejects.toBeDefined();
      expect((await storedRow(org.id, 'quotes'))?.enabled).toBe(true);

      await expect(
        admin.console.catalog.setKind({ organizationId: org.id, kind: 'services' }),
      ).rejects.toBeDefined();
      const profile = await testDb
        .select()
        .from(tenantProfile)
        .where(eq(tenantProfile.tenantId, org.id));
      expect(profile).toHaveLength(0);
    } finally {
      await testDb.execute(sql`ALTER TABLE platform_audit_log DROP CONSTRAINT test_reject_audit`);
    }
  });
});

describe('console.catalog.setKind', () => {
  it('setKind changes the catalog kind and audits catalog.set', async () => {
    const org = await createTestTenant('kind-org', 'Kind', { features: [] });
    await admin.console.catalog.setKind({ organizationId: org.id, kind: 'services' });

    const [profile] = await testDb
      .select()
      .from(tenantProfile)
      .where(eq(tenantProfile.tenantId, org.id));
    expect(profile?.catalogKind).toBe('services');
    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: adminId,
      action: 'catalog.set',
      tenantId: org.id,
      payload: { kind: 'services' },
    });
  });

  it('rejects an unknown kind', async () => {
    const org = await createTestTenant('badkind-org', 'BadKind', { features: [] });
    await expect(
      admin.console.catalog.setKind({ organizationId: org.id, kind: 'bogus' as never }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(await audit()).toHaveLength(0);
  });
});

describe('console features and catalog access', () => {
  it('rejects a non platform admin', async () => {
    const org = await createTestTenant('guard-org', 'Guard', { features: [] });
    const plainId = await createUserWithPassword('plain@example.com');
    const plain = consoleCallerFor({ id: plainId, isPlatformAdmin: true });
    const forbidden = { code: 'FORBIDDEN' };
    const organizationId = org.id;

    await expect(plain.console.features.list({ organizationId })).rejects.toMatchObject(forbidden);
    await expect(
      plain.console.features.set({ organizationId, key: 'quotes' }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      plain.console.features.unset({ organizationId, key: 'quotes' }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      plain.console.catalog.setKind({ organizationId, kind: 'services' }),
    ).rejects.toMatchObject(forbidden);
    expect(await audit()).toHaveLength(0);
    expect(await storedRow(org.id, 'quotes')).toBeUndefined();
  });

  it('returns NOT_FOUND for an unknown organization before writing anything', async () => {
    const organizationId = 'missing';
    const calls = [
      () => admin.console.features.list({ organizationId }),
      () => admin.console.features.set({ organizationId, key: 'quotes' }),
      () => admin.console.features.unset({ organizationId, key: 'quotes' }),
      () => admin.console.catalog.setKind({ organizationId, kind: 'services' }),
    ];
    for (const call of calls) {
      const err = await call().catch((e) => e);
      expect(err).toMatchObject({ code: 'NOT_FOUND' });
      expect(errorCode(err)).toBe(ErrorCodes.tenant.NOT_FOUND);
    }
    expect(await audit()).toHaveLength(0);
  });
});
