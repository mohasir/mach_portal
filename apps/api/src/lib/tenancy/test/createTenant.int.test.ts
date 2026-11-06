import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  stateSettings,
  user,
  verification,
} from '../../../db/schema';
import { TENANT_EXEMPT_TABLES } from '../../../db/schema/tenantColumn';
import { seedQuoteStages } from '../../../db/seeds/quoteStages';
import * as defaults from '../../../db/seeds/defaults';
import { addMember, createTestTenant, resetDb, testDb } from '../../../test/db';
import type { TenantCtx } from '../../../core/trpc/tenantCtx';
import { configModule } from '../../../modules/config/config.module';
import { quotesModule } from '../../../modules/quotes/quotes.module';
import { auth } from '../../auth';
import { createTenant } from '../createTenant';

vi.mock('../../../db/seeds/defaults', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../db/seeds/defaults')>();
  return { ...actual, seedTenantDefaults: vi.fn(actual.seedTenantDefaults) };
});

const ctxFor = (tenantId: string) => ({ tenantId }) as unknown as TenantCtx;

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

  describe('validation', () => {
    it.each(['Bad Slug!', 'a', '-abc', 'abc-', 'a'.repeat(33), 'ñandu'])(
      'rejects the invalid slug %j and writes nothing',
      async (slug) => {
        await expect(createTenant(input(slug, 'x@invalid.test'))).rejects.toMatchObject({
          code: 'BAD_REQUEST',
          cause: { code: 'TENANT_INVALID_SLUG' },
        });
        expect(await countOf(organization)).toBe(0);
        expect(await countOf(user)).toBe(0);
      },
    );

    it('normalizes the slug to lowercase before validating', async () => {
      const { tenantId } = await createTenant(input('Acme-Co', 'admin@acme.test'));
      const [org] = await testDb.select().from(organization).where(eq(organization.id, tenantId));
      expect(org!.slug).toBe('acme-co');
      expect(org!.name).toBe('Tenant Acme-Co');
    });

    it('rejects a duplicate slug without creating rows or an account', async () => {
      await createTenant(input('acme', 'first@acme.test'));
      const before = await Promise.all(tenantTables.map((t) => countOf(tableByName(t))));

      await expect(createTenant(input('ACME', 'second@acme.test'))).rejects.toMatchObject({
        code: 'CONFLICT',
        cause: { code: 'TENANT_SLUG_TAKEN' },
      });

      expect(await countOf(organization)).toBe(1);
      expect(await accountByEmail('second@acme.test')).toBeUndefined();
      expect(await Promise.all(tenantTables.map((t) => countOf(tableByName(t))))).toEqual(before);
    });

    it('two concurrent creates of one slug: one wins, the loser leaves no account behind', async () => {
      const results = await Promise.allSettled([
        createTenant(input('race', 'one@race.test')),
        createTenant(input('race', 'two@race.test')),
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
    it('has app_settings and state_settings, and config.get responds', async () => {
      const { tenantId } = await createTenant(input('acme'));
      expect(await rowsPerTenant('app_settings', tenantId)).toBe(1);
      expect(await rowsPerTenant('state_settings', tenantId)).toBe(3);

      const config = await configModule(ctxFor(tenantId)).get();
      expect(config.appSettings).toMatchObject({ quoteSeqStart: 1 });
      expect(config.stateSettings).toHaveLength(3);
      expect(config.quoteStages).toHaveLength(4);
    });

    it('seeds the per-tenant defaults: event types, reschedule reasons, catalog and PDF template', async () => {
      const { tenantId } = await createTenant(input('acme'));
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
      const { tenantId } = await createTenant(input('acme'));
      const admin = await accountByEmail('admin@acme.test');
      const [client] = await testDb
        .insert(clients)
        .values({ name: 'First client', tenantId })
        .returning({ id: clients.id });
      const [product] = await testDb
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.name, 'Crepes')));
      const [tier] = await testDb
        .select()
        .from(productPriceTiers)
        .where(eq(productPriceTiers.productId, product!.id))
        .orderBy(productPriceTiers.numPersons)
        .limit(1);

      const quote = await quotesModule(ctxFor(tenantId)).create(
        {
          clientId: client!.id,
          isDraft: true,
          selectOptionsAtQuote: false,
          lines: [
            {
              productId: product!.id,
              numPersons: tier!.numPersons,
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

    it('makes the admin a member with role admin and returns a setup link on WEB_APP_URL', async () => {
      const { tenantId, setupUrl } = await createTenant(input('acme', 'Boss@Acme.test'));
      const admin = await accountByEmail('boss@acme.test');
      expect(admin).toMatchObject({
        name: 'Admin acme',
        role: 'admin',
        mustChangePassword: true,
        isPlatformAdmin: false,
      });

      const memberships = await testDb.select().from(member).where(eq(member.userId, admin!.id));
      expect(memberships).toEqual([
        expect.objectContaining({ organizationId: tenantId, role: 'admin' }),
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

      await expect(createTenant(input('acme', 'PLATFORM@acme.test'))).rejects.toMatchObject({
        code: 'FORBIDDEN',
        cause: { code: 'USER_IS_PLATFORM_ADMIN' },
      });

      expect(await countOf(organization)).toBe(0);
      expect(await countOf(member)).toBe(0);
      expect(await countOf(user)).toBe(1);
      expect(await accountByEmail('platform@acme.test')).toMatchObject({
        isPlatformAdmin: true,
        mustChangePassword: false,
      });
    });

    it('attaches it as admin member without touching its credentials; setupUrl is null', async () => {
      const { user: existing } = await auth.api.signUpEmail({
        body: { name: 'Already here', email: 'known@acme.test', password: 'known-password-123' },
      });
      await testDb.update(user).set({ role: 'operator' }).where(eq(user.id, existing.id));
      const hashBefore = await credentialOf(existing.id);

      const { tenantId, setupUrl } = await createTenant(input('acme', 'KNOWN@acme.test'));

      expect(setupUrl).toBeNull();
      const after = await accountByEmail('known@acme.test');
      expect(after).toMatchObject({ name: 'Already here', mustChangePassword: false });
      expect(await credentialOf(existing.id)).toBe(hashBefore);
      expect(await tokensOf(existing.id)).toEqual([]);
      expect(await countOf(user)).toBe(1);
      const memberships = await testDb.select().from(member).where(eq(member.userId, existing.id));
      expect(memberships).toEqual([
        expect.objectContaining({ organizationId: tenantId, role: 'admin' }),
      ]);
      // Without any other membership the global role (what authorizes) follows.
      expect(after!.role).toBe('admin');
    });

    it('keeps the global role of an account that belongs to another tenant', async () => {
      const other = await createTestTenant('other');
      const { user: existing } = await auth.api.signUpEmail({
        body: { name: 'Shared', email: 'shared@acme.test', password: 'known-password-123' },
      });
      await testDb.update(user).set({ role: 'operator' }).where(eq(user.id, existing.id));
      await addMember(existing.id, other.id, 'operator');

      const { tenantId, setupUrl } = await createTenant(input('acme', 'shared@acme.test'));

      expect(setupUrl).toBeNull();
      expect((await accountByEmail('shared@acme.test'))!.role).toBe('operator');
      const roles = await testDb
        .select({ org: member.organizationId, role: member.role })
        .from(member)
        .where(eq(member.userId, existing.id));
      expect(roles).toHaveLength(2);
      expect(roles).toContainEqual({ org: tenantId, role: 'admin' });
      expect(roles).toContainEqual({ org: other.id, role: 'operator' });
    });
  });

  it('two consecutive tenants share no rows', async () => {
    const t1 = await createTenant(input('first'));
    const t2 = await createTenant(input('second'));
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
      await expect(createTenant(input('acme', 'new@acme.test'))).rejects.toThrow('boom');
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
      await expect(createTenant(input('acme', 'orphan@acme.test'))).rejects.toThrow('boom');
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

      await expect(createTenant(input('acme', 'raced@acme.test'))).rejects.toThrow('boom');
      const kept = await accountByEmail('raced@acme.test');
      expect(kept).toBeDefined();
      const memberships = await testDb.select().from(member).where(eq(member.userId, kept!.id));
      expect(memberships).toEqual([expect.objectContaining({ organizationId: other.id })]);
      expect(await countOf(organization)).toBe(1);
    });

    it('a retry after the failure succeeds and issues a setup link', async () => {
      failDefaults();
      await expect(createTenant(input('acme', 'retry@acme.test'))).rejects.toThrow('boom');
      const { setupUrl } = await createTenant(input('acme', 'retry@acme.test'));
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
      const results = await Promise.all(slugs.map((slug) => createTenant(input(slug))));
      expect(new Set(results.map((r) => r.tenantId)).size).toBe(16);
      expect(results.every((r) => r.setupUrl !== null)).toBe(true);
      expect(await countOf(organization)).toBe(16);
      expect(await countOf(member)).toBe(16);
      expect(await countOf(appSettings)).toBe(16);
    },
  );
});

function tableByName(name: string): PgTable {
  const table = (Object.values(schema).filter((v) => is(v, PgTable)) as unknown as PgTable[]).find(
    (t) => getTableConfig(t).name === name,
  );
  if (!table) throw new Error(`table ${name} not found`);
  return table;
}
