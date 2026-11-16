import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { is } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import {
  account,
  appSettings,
  clients,
  member,
  optionGroups,
  options,
  organization,
  productPriceTiers,
  products,
  role,
  stateSettings,
  user,
  verification,
} from '../../../db/schema';
import { TENANT_EXEMPT_TABLES } from '../../../db/schema/tenantColumn';
import { seedQuoteStages } from '../../../db/seeds/quoteStages';
import * as defaults from '../../../db/seeds/defaults';
import { addMember, createTestTenant, resetDb, testDb } from '../../../test/db';
import type { TenantCtx } from '../../../core/trpc/tenantCtx';
import type { Database } from '../../../db';
import {
  TEST_PLATFORM_ROLE,
  testAppDatabaseUrl,
  testPlatformDatabaseUrl,
} from '../../../test/roles';
import { configModule } from '../../../modules/config/config.module';
import { quotesModule } from '../../../modules/quotes/quotes.module';
import { auth } from '../../auth';
import { createTenant } from '../createTenant';
import { getCatalogKind } from '../profile';

vi.mock('../../../db/seeds/defaults', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../db/seeds/defaults')>();
  return { ...actual, seedTenantDefaults: vi.fn(actual.seedTenantDefaults) };
});

const ctxFor = (tenantId: string) =>
  ({ tenantId, db: testDb, features: new Set(['priceTiers']) }) as unknown as TenantCtx;

const tenantTables = (Object.values(schema).filter((v) => is(v, PgTable)) as unknown as PgTable[])
  .map((t) => getTableConfig(t).name)
  .filter((name) => !TENANT_EXEMPT_TABLES.includes(name));

const input = (slug: string, adminEmail = `admin@${slug}.test`) => ({
  slug,
  name: `Tenant ${slug}`,
  adminEmail,
  adminName: `Admin ${slug}`,
});

const countOf = async (table: PgTable) =>
  Number((await testDb.select({ n: sql<number>`count(*)` }).from(table))[0]!.n);

async function rowsPerTenant(table: string, tenantId: string) {
  const rows = await testDb.execute<{ n: string }>(
    sql`select count(*) as n from ${sql.identifier(table)} where tenant_id = ${tenantId}`,
  );
  return Number(rows[0]!.n);
}

async function accountByEmail(email: string) {
  const [row] = await testDb.select().from(user).where(eq(user.email, email));
  return row;
}

async function credentialOf(userId: string) {
  const [row] = await testDb
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
  return row?.password;
}

async function tokensOf(userId: string) {
  return testDb
    .select()
    .from(verification)
    .where(and(eq(verification.value, userId), like(verification.identifier, 'reset-password:%')));
}

describe('createTenant', () => {
  beforeEach(async () => {
    await resetDb();
    await seedQuoteStages();
  });

  afterEach(() => {
    vi.mocked(defaults.seedTenantDefaults).mockClear();
    vi.restoreAllMocks();
  });

  describe('catalog kind', () => {
    it('stores the requested kind in the profile of the new tenant', async () => {
      const { tenantId } = await createTenant(
        { ...input('kind-svc'), catalogKind: 'services' },
        testDb,
      );
      expect(await getCatalogKind(testDb, tenantId)).toBe('services');
    });

    it('writes no profile row when no kind is given, so the default applies', async () => {
      const { tenantId } = await createTenant(input('kind-default'), testDb);
      expect(await rowsPerTenant('tenant_profile', tenantId)).toBe(0);
      expect(await getCatalogKind(testDb, tenantId)).toBe('products');
    });

    it('rejects an unknown kind before creating the account or the organization', async () => {
      await expect(
        createTenant({ ...input('kind-bad'), catalogKind: 'stations' }, testDb),
      ).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        cause: { code: 'TENANT_UNKNOWN_CATALOG_KIND' },
      });
      expect(await countOf(organization)).toBe(0);
      expect(await countOf(user)).toBe(0);
    });
  });

  describe('validation', () => {
    it.each(['Bad Slug!', 'a', '-abc', 'abc-', 'a'.repeat(33), 'ñandu'])(
      'rejects the invalid slug %j and writes nothing',
      async (slug) => {
        await expect(createTenant(input(slug, 'x@invalid.test'), testDb)).rejects.toMatchObject({
          code: 'BAD_REQUEST',
          cause: { code: 'TENANT_INVALID_SLUG' },
        });
        expect(await countOf(organization)).toBe(0);
        expect(await countOf(user)).toBe(0);
      },
    );

    it('normalizes the slug to lowercase before validating', async () => {
      const { tenantId } = await createTenant(input('Acme-Co', 'admin@acme.test'), testDb);
      const [org] = await testDb.select().from(organization).where(eq(organization.id, tenantId));
      expect(org!.slug).toBe('acme-co');
      expect(org!.name).toBe('Tenant Acme-Co');
    });

    it('rejects a duplicate slug without creating rows or an account', async () => {
      await createTenant(input('acme', 'first@acme.test'), testDb);
      const before = await Promise.all(tenantTables.map((t) => countOf(tableByName(t))));

      await expect(createTenant(input('ACME', 'second@acme.test'), testDb)).rejects.toMatchObject({
        code: 'CONFLICT',
        cause: { code: 'TENANT_SLUG_TAKEN' },
      });

      expect(await countOf(organization)).toBe(1);
      expect(await accountByEmail('second@acme.test')).toBeUndefined();
      expect(await Promise.all(tenantTables.map((t) => countOf(tableByName(t))))).toEqual(before);
    });

    it('two concurrent creates of one slug: one wins, the loser leaves no account behind', async () => {
      const results = await Promise.allSettled([
        createTenant(input('race', 'one@race.test'), testDb),
        createTenant(input('race', 'two@race.test'), testDb),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ cause: { code: 'TENANT_SLUG_TAKEN' } });
      expect(await countOf(organization)).toBe(1);
      expect(await countOf(user)).toBe(1);
      expect(await countOf(member)).toBe(1);
    });
  });

  describe('a new tenant', () => {
    it('has the 4 base roles, with exactly one owner', async () => {
      const { tenantId } = await createTenant(input('acme'), testDb);
      const roles = await testDb.select().from(role).where(eq(role.tenantId, tenantId));
      expect(roles.map((r) => r.name).sort()).toEqual([
        'Admin',
        'Member',
        'Operator',
        'Superadmin',
      ]);
      expect(roles.filter((r) => r.isOwner).map((r) => r.name)).toEqual(['Superadmin']);
    });

    it('has app_settings and state_settings, and config.get responds', async () => {
      const { tenantId } = await createTenant(input('acme'), testDb);
      expect(await rowsPerTenant('app_settings', tenantId)).toBe(1);
      expect(await rowsPerTenant('state_settings', tenantId)).toBe(3);

      const config = await configModule(ctxFor(tenantId)).get();
      expect(config.appSettings).toMatchObject({ quoteSeqStart: 1 });
      expect(config.stateSettings).toHaveLength(3);
      expect(config.quoteStages).toHaveLength(4);
    });

    it('seeds the per-tenant defaults: event types, reschedule reasons, catalog and PDF template', async () => {
      const { tenantId } = await createTenant(input('acme'), testDb);
      for (const table of [
        'event_types',
        'reschedule_reasons',
        'products',
        'product_price_tiers',
        'option_groups',
        'options',
        'templates',
      ]) {
        expect(await rowsPerTenant(table, tenantId), table).toBeGreaterThan(0);
      }
      // Business data and global catalogs are not created for a new tenant.
      expect(await rowsPerTenant('quotes', tenantId)).toBe(0);
      expect(await rowsPerTenant('clients', tenantId)).toBe(0);
    });

    it('can create a quote right away, numbered from 1', async () => {
      const { tenantId } = await createTenant(input('acme'), testDb);
      const admin = await accountByEmail('admin@acme.test');
      const [client] = await testDb
        .insert(clients)
        .values({ name: 'First client', tenantId })
        .returning({ id: clients.id });
      const [product] = await testDb
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.name, 'Paquete Esencial')));
      const [tier] = await testDb
        .select()
        .from(productPriceTiers)
        .where(eq(productPriceTiers.productId, product!.id))
        .orderBy(productPriceTiers.quantity)
        .limit(1);

      const quote = await quotesModule(ctxFor(tenantId)).create(
        {
          clientId: client!.id,
          isDraft: true,
          selectOptionsAtQuote: false,
          lines: [
            {
              productId: product!.id,
              quantity: tier!.quantity,
              subtotal: tier!.price,
              selections: [],
            },
          ],
        },
        admin!.id,
        true,
      );
      expect(quote).toMatchObject({ seq: 1 });
      expect(quote.number).toMatch(/-000001$/);
    });

    it('makes the admin a member holding the owner role and returns a setup link on WEB_APP_URL', async () => {
      const { tenantId, setupUrl } = await createTenant(input('acme', 'Boss@Acme.test'), testDb);
      const admin = await accountByEmail('boss@acme.test');
      expect(admin).toMatchObject({
        name: 'Admin acme',
        mustChangePassword: true,
        isPlatformAdmin: false,
      });

      const [owner] = await testDb
        .select()
        .from(role)
        .where(and(eq(role.tenantId, tenantId), eq(role.isOwner, true)));
      const memberships = await testDb.select().from(member).where(eq(member.userId, admin!.id));
      expect(memberships).toEqual([
        expect.objectContaining({
          organizationId: tenantId,
          role: 'superadmin',
          roleId: owner!.id,
        }),
      ]);

      expect(setupUrl).toMatch(
        /^http:\/\/localhost:3000\/set-password\?token=[0-9a-f]+&reason=create$/,
      );
      const token = new URL(setupUrl!).searchParams.get('token');
      const tokens = await tokensOf(admin!.id);
      expect(tokens.map((t) => t.identifier)).toEqual([`reset-password:${token}`]);
      expect(tokens[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(await credentialOf(admin!.id)).toBeTruthy();
    });
  });

  describe('existing admin account', () => {
    it('rejects a platform admin account before writing anything', async () => {
      const { user: pa } = await auth.api.signUpEmail({
        body: { name: 'Platform', email: 'platform@acme.test', password: 'known-password-123' },
      });
      await testDb.update(user).set({ isPlatformAdmin: true }).where(eq(user.id, pa.id));

      await expect(createTenant(input('acme', 'PLATFORM@acme.test'), testDb)).rejects.toMatchObject(
        {
          code: 'FORBIDDEN',
          cause: { code: 'USER_IS_PLATFORM_ADMIN' },
        },
      );

      expect(await countOf(organization)).toBe(0);
      expect(await countOf(member)).toBe(0);
      expect(await countOf(user)).toBe(1);
      expect(await accountByEmail('platform@acme.test')).toMatchObject({
        isPlatformAdmin: true,
        mustChangePassword: false,
      });
    });

    it('attaches it as owner member without touching its credentials; setupUrl is null', async () => {
      const { user: existing } = await auth.api.signUpEmail({
        body: { name: 'Already here', email: 'known@acme.test', password: 'known-password-123' },
      });
      await testDb.update(user).set({ role: 'operator' }).where(eq(user.id, existing.id));
      const hashBefore = await credentialOf(existing.id);

      const { tenantId, setupUrl } = await createTenant(input('acme', 'KNOWN@acme.test'), testDb);

      expect(setupUrl).toBeNull();
      const after = await accountByEmail('known@acme.test');
      expect(after).toMatchObject({ name: 'Already here', mustChangePassword: false });
      expect(await credentialOf(existing.id)).toBe(hashBefore);
      expect(await tokensOf(existing.id)).toEqual([]);
      expect(await countOf(user)).toBe(1);
      const memberships = await testDb.select().from(member).where(eq(member.userId, existing.id));
      expect(memberships).toEqual([
        expect.objectContaining({ organizationId: tenantId, role: 'superadmin' }),
      ]);
      expect(after!.role).toBe('operator');
    });

    it('keeps the global role of an account that belongs to another tenant', async () => {
      const other = await createTestTenant('other');
      const { user: existing } = await auth.api.signUpEmail({
        body: { name: 'Shared', email: 'shared@acme.test', password: 'known-password-123' },
      });
      await testDb.update(user).set({ role: 'operator' }).where(eq(user.id, existing.id));
      await addMember(existing.id, other.id, 'operator');

      const { tenantId, setupUrl } = await createTenant(input('acme', 'shared@acme.test'), testDb);

      expect(setupUrl).toBeNull();
      expect((await accountByEmail('shared@acme.test'))!.role).toBe('operator');
      const roles = await testDb
        .select({ org: member.organizationId, role: member.role })
        .from(member)
        .where(eq(member.userId, existing.id));
      expect(roles).toHaveLength(2);
      expect(roles).toContainEqual({ org: tenantId, role: 'superadmin' });
      expect(roles).toContainEqual({ org: other.id, role: 'operator' });
    });
  });

  it('two consecutive tenants share no rows', async () => {
    const t1 = await createTenant(input('first'), testDb);
    const t2 = await createTenant(input('second'), testDb);
    expect(t1.tenantId).not.toBe(t2.tenantId);
    expect(t1.setupUrl).not.toBe(t2.setupUrl);

    for (const table of tenantTables) {
      const n1 = await rowsPerTenant(table, t1.tenantId);
      const n2 = await rowsPerTenant(table, t2.tenantId);
      expect(n1, table).toBe(n2);
    }

    // Children always carry the tenant of their parent, so no catalog row is reachable from the
    // other tenant through a foreign key.
    const mismatches = await testDb.execute<{ n: string }>(sql`
      select (
        (select count(*) from ${productPriceTiers} t join ${products} p on p.id = t.product_id where p.tenant_id <> t.tenant_id) +
        (select count(*) from ${optionGroups} g join ${products} p on p.id = g.product_id where p.tenant_id <> g.tenant_id) +
        (select count(*) from ${options} o join ${optionGroups} g on g.id = o.option_group_id where g.tenant_id <> o.tenant_id)
      ) as n
    `);
    expect(Number(mismatches[0]!.n)).toBe(0);

    const appRows = await testDb.select().from(appSettings);
    expect(appRows.map((r) => r.tenantId).sort()).toEqual([t1.tenantId, t2.tenantId].sort());
    const stateRows = await testDb.select().from(stateSettings);
    expect(stateRows).toHaveLength(6);

    const admins = await testDb
      .select({ org: member.organizationId })
      .from(member)
      .where(inArray(member.organizationId, [t1.tenantId, t2.tenantId]));
    expect(admins.map((a) => a.org).sort()).toEqual([t1.tenantId, t2.tenantId].sort());
  });

  describe('failure inside the transaction', () => {
    const failDefaults = () =>
      vi.mocked(defaults.seedTenantDefaults).mockRejectedValueOnce(new Error('boom'));

    it('leaves no organization and deletes the account this call created', async () => {
      failDefaults();
      await expect(createTenant(input('acme', 'new@acme.test'), testDb)).rejects.toThrow('boom');
      expect(await countOf(organization)).toBe(0);
      expect(await countOf(member)).toBe(0);
      expect(await accountByEmail('new@acme.test')).toBeUndefined();
      expect(await countOf(account)).toBe(0);
      for (const table of tenantTables) expect(await countOf(tableByName(table)), table).toBe(0);
    });

    it('keeps an existing account it did not create, even without memberships', async () => {
      const { user: existing } = await auth.api.signUpEmail({
        body: { name: 'Orphan', email: 'orphan@acme.test', password: 'known-password-123' },
      });
      failDefaults();
      await expect(createTenant(input('acme', 'orphan@acme.test'), testDb)).rejects.toThrow('boom');
      expect(await countOf(organization)).toBe(0);
      expect(await accountByEmail('orphan@acme.test')).toMatchObject({ id: existing.id });
    });

    it('keeps an account it created that got a membership elsewhere meanwhile', async () => {
      const other = await createTestTenant('other');
      const realSignUp = auth.api.signUpEmail.bind(auth.api);
      vi.spyOn(auth.api, 'signUpEmail').mockImplementationOnce((async (
        args: Parameters<typeof auth.api.signUpEmail>[0],
      ) => {
        const result = await realSignUp(args);
        await addMember(result.user.id, other.id, 'operator');
        return result;
      }) as typeof auth.api.signUpEmail);
      failDefaults();

      await expect(createTenant(input('acme', 'raced@acme.test'), testDb)).rejects.toThrow('boom');
      const kept = await accountByEmail('raced@acme.test');
      expect(kept).toBeDefined();
      const memberships = await testDb.select().from(member).where(eq(member.userId, kept!.id));
      expect(memberships).toEqual([expect.objectContaining({ organizationId: other.id })]);
      expect(await countOf(organization)).toBe(1);
    });

    it('a retry after the failure succeeds and issues a setup link', async () => {
      failDefaults();
      await expect(createTenant(input('acme', 'retry@acme.test'), testDb)).rejects.toThrow('boom');
      const { setupUrl } = await createTenant(input('acme', 'retry@acme.test'), testDb);
      expect(setupUrl).toMatch(/reason=create$/);
      expect(await countOf(user)).toBe(1);
      expect(await countOf(member)).toBe(1);
    });
  });

  it(
    'more concurrent creates than the pool size complete without hanging',
    { timeout: 60_000 },
    async () => {
      const slugs = Array.from({ length: 16 }, (_, i) => `bulk-${i}-${randomUUID().slice(0, 6)}`);
      const results = await Promise.all(slugs.map((slug) => createTenant(input(slug), testDb)));
      expect(new Set(results.map((r) => r.tenantId)).size).toBe(16);
      expect(results.every((r) => r.setupUrl !== null)).toBe(true);
      expect(await countOf(organization)).toBe(16);
      expect(await countOf(member)).toBe(16);
      expect(await countOf(appSettings)).toBe(16);
    },
  );
});

describe('createTenant with the database roles', () => {
  const clientsToClose: ReturnType<typeof postgres>[] = [];
  const connect = (url: string) => {
    const client = postgres(url, { max: 2 });
    clientsToClose.push(client);
    return drizzle(client, { schema }) as unknown as Database;
  };
  let platformDb: Database;
  let appDb: Database;

  beforeAll(async () => {
    platformDb = connect(testPlatformDatabaseUrl());
    appDb = connect(testAppDatabaseUrl());
    const [row] = await platformDb.execute<{ who: string }>(sql`select current_user as who`);
    expect(row?.who).toBe(TEST_PLATFORM_ROLE);
  });

  afterAll(async () => {
    await Promise.all(clientsToClose.map((client) => client.end()));
  });

  beforeEach(async () => {
    await resetDb();
    await seedQuoteStages();
  });

  it('creates the tenant, its defaults and its first admin through the platform role', async () => {
    const { tenantId, setupUrl } = await createTenant(input('acme'), platformDb);

    expect(setupUrl).toMatch(/reason=create$/);
    expect(await rowsPerTenant('app_settings', tenantId)).toBe(1);
    expect(await rowsPerTenant('role', tenantId)).toBe(4);
    expect(await rowsPerTenant('products', tenantId)).toBeGreaterThan(0);
    const admin = await accountByEmail('admin@acme.test');
    const memberships = await testDb.select().from(member).where(eq(member.userId, admin!.id));
    expect(memberships).toEqual([expect.objectContaining({ organizationId: tenantId })]);
  });

  it('cannot write the tenant rows through the app role, and leaves nothing behind', async () => {
    const error = await createTenant(input('acme'), appDb).then(
      () => undefined,
      (e: unknown) => e,
    );
    // Drizzle wraps the driver error, so the Postgres message is somewhere down the cause chain.
    const messages: string[] = [];
    for (let e = error as Error | undefined; e; e = e.cause as Error | undefined) {
      messages.push(e.message);
    }
    expect(messages).toContainEqual(
      expect.stringMatching(/new row violates row-level security policy/),
    );

    expect(await countOf(organization)).toBe(0);
    expect(await accountByEmail('admin@acme.test')).toBeUndefined();
  });
});

function tableByName(name: string): PgTable {
  const table = (Object.values(schema).filter((v) => is(v, PgTable)) as unknown as PgTable[]).find(
    (t) => getTableConfig(t).name === name,
  );
  if (!table) throw new Error(`table ${name} not found`);
  return table;
}
