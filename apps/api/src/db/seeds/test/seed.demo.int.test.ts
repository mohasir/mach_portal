import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, is, sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { FEATURE_KEYS, isToggleable } from '@repo/guards';
import { QUOTE_STAGE } from '@repo/schemas';
import * as schema from '../../schema';
import { account, clients, member, organization, products, quotes, role, user } from '../../schema';
import { PLATFORM_MANAGED_TABLES } from '../../rls/policy';
import { TENANT_EXEMPT_TABLES } from '../../schema/tenantColumn';
import { createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';
import { testPlatformDatabaseUrl } from '../../../test/roles';
import { db, type Database } from '../../index';
import {
  DEMO_PLATFORM_ADMIN_EMAIL,
  DEMO_SHARED_USER_EMAIL,
  seedDemoIntoTenant,
  seedDemoLocal,
} from '../demo';
import { PROD_SUPERADMIN_EMAIL, seedProdTenant } from '../prod';

const allTables = (Object.values(schema).filter((v) => is(v, PgTable)) as unknown as PgTable[]).map(
  (t) => getTableConfig(t).name,
);
// The audit log only fills when roles are edited, which the seed never does; product images need
// their files in object storage, so the seed leaves every product with the placeholder.
const UNSEEDED_TABLES = ['role_audit_log', 'product_images'];
// Feature tables hold platform-managed state, not tenant business data, so these checks skip them.
const tenantTables = allTables.filter(
  (name) =>
    !TENANT_EXEMPT_TABLES.includes(name) &&
    !UNSEEDED_TABLES.includes(name) &&
    !PLATFORM_MANAGED_TABLES.includes(name),
);

async function rowsByTenant(table: string) {
  const rows = await testDb.execute<{ tenant_id: string | null; n: string }>(
    sql`select tenant_id, count(*) as n from ${sql.identifier(table)} group by tenant_id`,
  );
  return new Map(rows.map((r) => [r.tenant_id, Number(r.n)]));
}

async function countAll(table: string) {
  const rows = await testDb.execute<{ n: string }>(
    sql`select count(*) as n from ${sql.identifier(table)}`,
  );
  return Number(rows[0]!.n);
}

async function tenantIdOf(slug: string) {
  const [org] = await testDb.select().from(organization).where(eq(organization.slug, slug));
  return org!.id;
}

// Seeded through the platform role, as `db:seed` does, so every check below also covers RLS.
describe('db:seed --demo=local', () => {
  let norte: string;
  let sur: string;
  let platformClient: ReturnType<typeof postgres>;
  let platformDb: Database;

  beforeAll(async () => {
    platformClient = postgres(testPlatformDatabaseUrl(), { max: 4 });
    platformDb = drizzle(platformClient, { schema }) as unknown as Database;
    await resetDb();
    const globalPool = (
      ['select', 'insert', 'update', 'delete', 'execute', 'transaction'] as const
    ).map((method) => vi.spyOn(db, method));
    await seedDemoLocal(platformDb);
    for (const spy of globalPool) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    norte = await tenantIdOf('demo-norte');
    sur = await tenantIdOf('demo-sur');
  }, 120_000);

  afterAll(async () => {
    await platformClient?.end();
  });

  it('creates the two demo tenants', async () => {
    const orgs = await testDb.select().from(organization).orderBy(organization.slug);
    expect(orgs.map((o) => [o.slug, o.name])).toEqual([
      ['demo-norte', 'Demo Norte'],
      ['demo-sur', 'Demo Sur'],
    ]);
  });

  it('every tenant-scoped table has rows for both tenants and none for anyone else', async () => {
    expect(tenantTables.length).toBeGreaterThan(20);
    for (const table of tenantTables) {
      const byTenant = await rowsByTenant(table);
      expect(byTenant.get(norte) ?? 0, `${table} norte`).toBeGreaterThan(0);
      expect(byTenant.get(sur) ?? 0, `${table} sur`).toBeGreaterThan(0);
      expect([...byTenant.keys()].sort(), table).toEqual([norte, sur].sort());
    }
  });

  it('child rows carry the tenant of their parent', async () => {
    const pairs: [string, string, string][] = [
      ['product_price_tiers', 'products', 'product_id'],
      ['option_groups', 'products', 'product_id'],
      ['options', 'option_groups', 'option_group_id'],
      ['quotes', 'clients', 'client_id'],
      ['quote_lines', 'quotes', 'quote_id'],
      ['quote_lines', 'products', 'product_id'],
      ['quote_line_options', 'quote_lines', 'quote_line_id'],
      ['quote_line_options', 'options', 'option_id'],
      ['quote_stage_history', 'quotes', 'quote_id'],
      ['quote_assignment_history', 'quotes', 'quote_id'],
      ['events', 'quotes', 'quote_id'],
      ['event_staff', 'events', 'event_id'],
      ['event_staff', 'staff', 'staff_id'],
      ['event_payments', 'events', 'event_id'],
      ['event_payment_attachments', 'event_payments', 'payment_id'],
      ['event_history', 'events', 'event_id'],
      ['event_reschedules', 'events', 'event_id'],
      ['event_reschedules', 'reschedule_reasons', 'reason_id'],
      ['notification_reads', 'notifications', 'notification_id'],
    ];
    for (const [child, parent, fk] of pairs) {
      const rows = await testDb.execute<{ n: string }>(sql`
        select count(*) as n from ${sql.identifier(child)} c
        join ${sql.identifier(parent)} p on p.id = c.${sql.identifier(fk)}
        where p.tenant_id <> c.tenant_id
      `);
      expect(Number(rows[0]!.n), `${child}.${fk}`).toBe(0);
    }
  });

  it('the two tenants are recognizably different', async () => {
    const namesOf = async (tenantId: string) => ({
      clients: (
        await testDb.select({ v: clients.name }).from(clients).where(eq(clients.tenantId, tenantId))
      ).map((r) => r.v),
      products: (
        await testDb
          .select({ v: products.name })
          .from(products)
          .where(eq(products.tenantId, tenantId))
      ).map((r) => r.v),
      totals: (
        await testDb.select({ v: quotes.total }).from(quotes).where(eq(quotes.tenantId, tenantId))
      ).map((r) => r.v),
    });
    const n = await namesOf(norte);
    const s = await namesOf(sur);
    expect(n.clients.filter((c) => s.clients.includes(c))).toEqual([]);
    expect(n.products.filter((p) => s.products.includes(p))).toEqual([]);
    expect(n.totals.filter((t) => t > 0).filter((t) => s.totals.includes(t))).toEqual([]);
  });

  it('quotes cover every stage in both tenants', async () => {
    for (const tenantId of [norte, sur]) {
      const rows = await testDb
        .selectDistinct({ stageId: quotes.stageId })
        .from(quotes)
        .where(eq(quotes.tenantId, tenantId));
      expect(rows.map((r) => r.stageId).sort()).toEqual(Object.values(QUOTE_STAGE).sort());
    }
  });

  it('each tenant has members of every role, all able to sign in with a password', async () => {
    for (const tenantId of [norte, sur]) {
      const rows = await testDb
        .selectDistinct({ role: member.role })
        .from(member)
        .where(eq(member.organizationId, tenantId));
      expect(rows.map((r) => r.role).sort()).toEqual(['admin', 'member', 'operator', 'superadmin']);
    }
    const withoutCredential = await testDb.execute<{ n: string }>(sql`
      select count(*) as n from ${user} u
      where not exists (select 1 from ${account} a where a.user_id = u.id and a.provider_id = 'credential' and a.password is not null)
    `);
    expect(Number(withoutCredential[0]!.n)).toBe(0);
  });

  it('seeds the base roles and their permissions for each demo tenant', async () => {
    for (const tenantId of [norte, sur]) {
      const roles = await testDb.select().from(role).where(eq(role.tenantId, tenantId));
      expect(roles).toHaveLength(4);
      expect(roles.filter((r) => r.isOwner)).toHaveLength(1);
      expect((await rowsByTenant('role_permission')).get(tenantId) ?? 0).toBeGreaterThan(0);
    }
  });

  it('every member holds the role of its key inside its own tenant', async () => {
    const rows = await testDb.execute<{ key: string; role_name: string; same: boolean }>(sql`
      select m.role as key, r.name as role_name, (r.tenant_id = m.organization_id) as same
      from member m left join role r on r.id = m.role_id
    `);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.same).toBe(true);
      expect(r.role_name.toLowerCase()).toBe(r.key);
    }
  });

  it('activates every toggleable feature for each demo tenant, permanent and unpriced', async () => {
    const expected = FEATURE_KEYS.filter(isToggleable).sort();
    for (const tenant of [norte, sur]) {
      const rows = await testDb.execute<{
        feature_key: string;
        enabled: boolean;
        expires_at: Date | null;
        price_cents: number | null;
      }>(sql`
        SELECT feature_key, enabled, expires_at, price_cents FROM tenant_features
        WHERE tenant_id = ${tenant} ORDER BY feature_key`);
      expect(rows.map((r) => r.feature_key)).toEqual(expected);
      expect(rows.every((r) => r.enabled && r.expires_at === null && r.price_cents === null)).toBe(
        true,
      );
      const events = await testDb.execute<{ action: string; actor: string }>(sql`
        SELECT action, actor FROM tenant_feature_events WHERE tenant_id = ${tenant}`);
      expect(events).toHaveLength(expected.length);
      expect(events.every((e) => e.action === 'enabled' && e.actor === 'seed')).toBe(true);
    }
  });

  it('the platform admin has the flag and no membership', async () => {
    const [platform] = await testDb
      .select()
      .from(user)
      .where(eq(user.email, DEMO_PLATFORM_ADMIN_EMAIL));
    expect(platform).toMatchObject({ isPlatformAdmin: true });
    expect(await testDb.select().from(member).where(eq(member.userId, platform!.id))).toEqual([]);
    const others = await testDb.select().from(user).where(eq(user.isPlatformAdmin, true));
    expect(others.map((u) => u.email)).toEqual([DEMO_PLATFORM_ADMIN_EMAIL]);
  });

  it('the shared user is a member of both tenants with different roles', async () => {
    const [shared] = await testDb.select().from(user).where(eq(user.email, DEMO_SHARED_USER_EMAIL));
    const rows = await testDb
      .select({ org: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, shared!.id));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.org).sort()).toEqual([norte, sur].sort());
    expect(rows[0]!.role).not.toBe(rows[1]!.role);
    const roleIds = await testDb
      .select({ org: member.organizationId, roleId: member.roleId })
      .from(member)
      .where(eq(member.userId, shared!.id));
    expect(new Set(roleIds.map((r) => r.roleId)).size).toBe(2);
    const norteRole = roleIds.find((r) => r.org === norte)!.roleId!;
    const [r] = await testDb.select().from(role).where(eq(role.id, norteRole));
    expect(r).toMatchObject({ tenantId: norte, name: 'Operator' });
  });

  it('re-running the seed is idempotent', { timeout: 120_000 }, async () => {
    const before = await Promise.all(allTables.map(countAll));
    await seedDemoLocal(platformDb);
    const after = await Promise.all(allTables.map(countAll));
    expect(Object.fromEntries(allTables.map((t, i) => [t, after[i]]))).toEqual(
      Object.fromEntries(allTables.map((t, i) => [t, before[i]])),
    );
  });
});

describe('db:seed --demo=prod --tenant', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('fails for a tenant that does not exist', async () => {
    await expect(seedProdTenant('missing-tenant')).rejects.toThrow(/missing-tenant/);
    expect(await countAll('quote_stages')).toBe(0);
  });

  it('seeds only the defaults (plus the global quote stages) into an existing tenant, idempotently', async () => {
    // Without the helper's units, so the counts below show what the prod seed itself writes.
    const tenant = await createTestTenant('acme', 'acme', { units: false });
    const other = await createTestTenant('other', 'other', { units: false });
    await seedProdTenant('acme');
    const once = await Promise.all(tenantTables.map(countAll));
    await seedProdTenant('ACME');
    expect(await Promise.all(tenantTables.map(countAll))).toEqual(once);

    expect(await countAll('quote_stages')).toBe(4);
    for (const table of [
      'app_settings',
      'state_settings',
      'event_types',
      'products',
      'templates',
      'units_of_measure',
    ]) {
      expect((await rowsByTenant(table)).get(tenant.id) ?? 0, table).toBeGreaterThan(0);
    }
    for (const table of tenantTables) {
      expect((await rowsByTenant(table)).get(other.id) ?? 0, table).toBe(0);
    }
    expect(await countAll('quotes')).toBe(0);
    expect(await countAll('clients')).toBe(0);
    expect(await countAll('user')).toBe(0);
  });

  it('marks an existing real superadmin as platform admin without adding any membership', async () => {
    await resetDb();
    await createTestTenant('acme');
    await createTestTenant('beta');
    const superadmin = await createTestUser({ email: PROD_SUPERADMIN_EMAIL, role: 'superadmin' });
    const lucia = await createTestUser({ email: 'someone@admin.com', role: 'admin' });

    await seedProdTenant('acme');
    await seedProdTenant('beta');

    const [after] = await testDb.select().from(user).where(eq(user.id, superadmin.id));
    expect(after).toMatchObject({ isPlatformAdmin: true, role: 'superadmin' });
    expect(await testDb.select().from(member)).toEqual([]);
    const [other] = await testDb.select().from(user).where(eq(user.id, lucia.id));
    expect(other).toMatchObject({ isPlatformAdmin: false, role: 'admin' });
  });
});

describe('db:seed --demo=local --tenant', () => {
  it('seeds the full demo into an existing tenant only', { timeout: 120_000 }, async () => {
    await resetDb();
    const tenant = await createTestTenant('acme');
    await expect(seedDemoIntoTenant('nope')).rejects.toThrow(/nope/);
    await seedDemoIntoTenant('acme');

    for (const table of tenantTables) {
      expect([...(await rowsByTenant(table)).keys()], table).toEqual([tenant.id]);
    }
    const [admin] = await testDb.select().from(user).where(eq(user.email, 'admin@acme.demo'));
    const rows = await testDb.select().from(member).where(eq(member.userId, admin!.id));
    expect(rows).toEqual([expect.objectContaining({ organizationId: tenant.id, role: 'admin' })]);
    expect(rows[0]!.roleId).not.toBeNull();
    expect(await countAll('organization')).toBe(1);
    const features = await testDb.execute<{ tenant_id: string }>(
      sql`SELECT tenant_id FROM tenant_features`,
    );
    expect(features).toHaveLength(FEATURE_KEYS.filter(isToggleable).length);
    expect(features.every((f) => f.tenant_id === tenant.id)).toBe(true);
  });
});
