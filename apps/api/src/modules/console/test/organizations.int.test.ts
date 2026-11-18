import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { organization, platformAuditLog, tenantFeatures, tenantProfile } from '../../../db/schema';
import { ErrorCodes } from '../../../lib/errors';
import { createUserWithPassword } from '../../../test/authHelpers';
import {
  ALL_TOGGLEABLE_FEATURES,
  addMember,
  createTestTenant,
  resetDb,
  testDb,
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

const audit = () => testDb.select().from(platformAuditLog);
const errorCode = (e: unknown) => (e as { cause?: { code?: string } }).cause?.code;

describe('console.organizations.list', () => {
  it('lists every organization with its catalog kind and active feature count', async () => {
    const full = await createTestTenant('full-org', 'Full Org');
    const bare = await createTestTenant('bare-org', 'Bare Org', { features: [] });
    await testDb.insert(tenantProfile).values({ tenantId: bare.id, catalogKind: 'services' });
    const expiry = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await testDb
      .update(tenantFeatures)
      .set({ expiresAt: expiry })
      .where(eq(tenantFeatures.tenantId, full.id));

    const result = await admin.console.organizations.list({ sortBy: 'name', sortDir: 'asc' });
    const byId = new Map(result.items.map((o) => [o.id, o]));
    expect(result.items).toHaveLength(2);
    expect(byId.get(full.id)).toMatchObject({
      slug: 'full-org',
      name: 'Full Org',
      catalogKind: 'products',
      activeFeatureCount: ALL_TOGGLEABLE_FEATURES.length,
      nextExpiry: expiry.toISOString(),
    });
    expect(byId.get(bare.id)).toMatchObject({
      catalogKind: 'services',
      activeFeatureCount: 0,
      nextExpiry: null,
    });
  });

  it('filters by search and treats % and _ literally', async () => {
    await createTestTenant('plain', 'Plain Co', { features: [] });
    await createTestTenant('pct', '100% Fun', { features: [] });
    await createTestTenant('under', 'a_b Shop', { features: [] });
    await createTestTenant('axb', 'axb Shop', { features: [] });

    const names = async (search: string) =>
      (
        await admin.console.organizations.list({ search, sortBy: 'name', sortDir: 'asc' })
      ).items.map((o) => o.name);
    expect(await names('plain')).toEqual(['Plain Co']);
    expect(await names('%')).toEqual(['100% Fun']);
    expect(await names('a_b')).toEqual(['a_b Shop']);
    expect(await names('\\')).toEqual([]);
  });

  it('paginates', async () => {
    for (const n of ['a', 'b', 'c'])
      await createTestTenant(`org-${n}`, `Org ${n}`, { features: [] });
    const page = await admin.console.organizations.list({
      page: 2,
      pageSize: 2,
      sortBy: 'name',
      sortDir: 'asc',
    });
    expect(page.items.map((o) => o.name)).toEqual(['Org c']);
    expect(page).toMatchObject({ pagination: { total: 3, page: 2, pageSize: 2, totalPages: 2 } });
  });
});

describe('console.organizations access', () => {
  it('rejects a non platform admin on list, get and create', async () => {
    const tenant = await createTestTenant('t1', 't1', { features: [] });
    const plainId = await createUserWithPassword('plain@example.com');
    const plain = consoleCallerFor({ id: plainId, isPlatformAdmin: true });
    const forbidden = { code: 'FORBIDDEN' };

    await expect(
      plain.console.organizations.list({ sortBy: 'name', sortDir: 'asc' }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      plain.console.organizations.get({ organizationId: tenant.id }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      plain.console.organizations.create({
        slug: 'nope',
        name: 'Nope',
        adminEmail: 'a@example.com',
        adminName: 'A',
      }),
    ).rejects.toMatchObject(forbidden);
    expect(await audit()).toHaveLength(0);
  });

  it('rejects an organization owner who is not a platform admin', async () => {
    const tenant = await createTestTenant('owned', 'Owned', { features: [] });
    const ownerId = await createUserWithPassword('owner-only@example.com');
    await addMember(ownerId, tenant.id, 'superadmin');
    const owner = consoleCallerFor({ id: ownerId, isPlatformAdmin: true });
    const forbidden = { code: 'FORBIDDEN' };

    await expect(
      owner.console.organizations.list({ sortBy: 'name', sortDir: 'asc' }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      owner.console.organizations.get({ organizationId: tenant.id }),
    ).rejects.toMatchObject(forbidden);
    await expect(
      owner.console.organizations.create({
        slug: 'nope',
        name: 'Nope',
        adminEmail: 'a@example.com',
        adminName: 'A',
      }),
    ).rejects.toMatchObject(forbidden);
    expect(await audit()).toHaveLength(0);
  });
});

describe('console.organizations.get', () => {
  it('returns NOT_FOUND with the tenant error code for an unknown id', async () => {
    const err = await admin.console.organizations
      .get({ organizationId: 'missing' })
      .catch((e) => e);
    expect(err).toMatchObject({ code: 'NOT_FOUND' });
    expect(errorCode(err)).toBe(ErrorCodes.tenant.NOT_FOUND);
    expect(await audit()).toHaveLength(0);
  });

  it('returns the organization', async () => {
    const tenant = await createTestTenant('detail', 'Detail', { features: [] });
    expect(await admin.console.organizations.get({ organizationId: tenant.id })).toMatchObject({
      id: tenant.id,
      slug: 'detail',
      catalogKind: 'products',
    });
  });

  it('records one organization.view audit row per session', async () => {
    const tenant = await createTestTenant('viewed', 'Viewed', { features: [] });
    await admin.console.organizations.get({ organizationId: tenant.id });
    await admin.console.organizations.get({ organizationId: tenant.id });
    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: adminId,
      action: 'organization.view',
      tenantId: tenant.id,
    });

    const other = consoleCallerFor({ id: adminId }, { sessionId: 'another-session' });
    await other.console.organizations.get({ organizationId: tenant.id });
    expect(await audit()).toHaveLength(2);
  });
});

describe('console.organizations.create', () => {
  const input = {
    slug: 'new-org',
    name: 'New Org',
    adminEmail: 'owner@example.com',
    adminName: 'Owner',
    catalogKind: 'services' as const,
  };

  it('provisions the organization and returns the setup link', async () => {
    const result = await admin.console.organizations.create(input);
    expect(result.setupUrl).toContain('/set-password?token=');
    const [org] = await testDb
      .select()
      .from(organization)
      .where(eq(organization.id, result.tenantId));
    expect(org).toMatchObject({ slug: 'new-org', name: 'New Org' });
    const [profile] = await testDb
      .select()
      .from(tenantProfile)
      .where(eq(tenantProfile.tenantId, result.tenantId));
    expect(profile?.catalogKind).toBe('services');
  });

  it('audits organization.create without the setup link in the payload', async () => {
    const result = await admin.console.organizations.create(input);
    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: adminId,
      action: 'organization.create',
      tenantId: result.tenantId,
      payload: {
        slug: 'new-org',
        name: 'New Org',
        adminEmail: 'owner@example.com',
        catalogKind: 'services',
      },
    });
    const serialized = JSON.stringify(rows[0]?.payload);
    expect(serialized).not.toContain('setupUrl');
    expect(serialized).not.toContain(result.setupUrl!.split('token=')[1]!.split('&')[0]!);
  });

  it('audits the normalized slug and email, not the raw input', async () => {
    const result = await admin.console.organizations.create({
      ...input,
      slug: 'Mixed-Org',
      adminEmail: 'Owner@Example.COM',
    });
    const [row] = await audit();
    expect(row?.tenantId).toBe(result.tenantId);
    expect(row?.payload).toMatchObject({ slug: 'mixed-org', adminEmail: 'owner@example.com' });
    expect(JSON.stringify(row?.payload)).not.toContain('setupUrl');
  });

  it('maps a taken slug to CONFLICT with ErrorCodes.tenant.SLUG_TAKEN', async () => {
    await createTestTenant('new-org', 'Existing', { features: [] });
    const err = await admin.console.organizations.create(input).catch((e) => e);
    expect(err).toMatchObject({ code: 'CONFLICT' });
    expect(errorCode(err)).toBe(ErrorCodes.tenant.SLUG_TAKEN);
    expect(await audit()).toHaveLength(0);
  });
});
