import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TEST_APP_PASSWORD,
  TEST_APP_ROLE,
  TEST_PLATFORM_PASSWORD,
  TEST_PLATFORM_ROLE,
} from '../../../test/roles';
import { runMigrate } from '../../scripts/migrate';
import { ensureRoles } from '../roles';
import { TENANT_TABLES } from '../../scripts/verifyMultitenant';
import { PLATFORM_MANAGED_TABLES, tenantPolicyName, tenantReadPolicyName } from '../policy';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const ISOLATED_TABLES = [...TENANT_TABLES, 'platform_access_log'].sort();
const RLS_TABLES = [...ISOLATED_TABLES, ...PLATFORM_MANAGED_TABLES].sort();
const SAME_TENANT = "(tenant_id = current_setting('app.tenant_id'::text, true))";

const withDatabase = (name: string, user?: { name: string; password: string }) => {
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  if (user) {
    url.username = user.name;
    url.password = user.password;
  }
  return url.toString();
};

// Built from the real migration files (not drizzle-kit push), so it proves what db:migrate ships.
describe('RLS migration', () => {
  const name = `mt_rls_test_${randomBytes(6).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;

  beforeAll(async () => {
    admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    await runMigrate(withDatabase(name));
    sql = postgres(withDatabase(name), { max: 1, onnotice: () => {} });
    const [row] = await sql<{ owner: string }[]>`SELECT current_user AS owner`;
    await ensureRoles(sql, {
      appRole: TEST_APP_ROLE,
      appPassword: TEST_APP_PASSWORD,
      platformRole: TEST_PLATFORM_ROLE,
      platformPassword: TEST_PLATFORM_PASSWORD,
      ownerRole: row!.owner,
    });
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
  });

  it('enables and forces row level security on exactly the tenant tables', async () => {
    const rows = await sql<{ table: string; enabled: boolean; forced: boolean }[]>`
      SELECT c.relname AS table, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
        AND (c.relrowsecurity OR c.relforcerowsecurity)
      ORDER BY c.relname`;
    expect(rows.map((r) => r.table)).toEqual(RLS_TABLES);
    expect(RLS_TABLES).toContain('units_of_measure');
    expect(RLS_TABLES).toContain('product_categories');
    expect(RLS_TABLES).toContain('product_images');
    for (const row of rows) expect(row, row.table).toMatchObject({ enabled: true, forced: true });
  });

  it('gives every tenant table its isolation policy and no other', async () => {
    const all = await sql<
      {
        table: string;
        policy: string;
        permissive: string;
        roles: string[];
        cmd: string;
        qual: string;
        check: string;
      }[]
    >`
      SELECT tablename AS table, policyname AS policy, permissive, roles, cmd,
             qual, with_check AS check
      FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename`;
    const policies = all.filter((p) => ISOLATED_TABLES.includes(p.table));
    expect(policies.map((p) => p.table)).toEqual(ISOLATED_TABLES);
    for (const p of policies) {
      expect(p, p.table).toEqual({
        table: p.table,
        policy: tenantPolicyName(p.table),
        permissive: 'PERMISSIVE',
        roles: ['public'],
        cmd: 'ALL',
        qual: SAME_TENANT,
        check: SAME_TENANT,
      });
    }
  });

  it('gives tenant_features and tenant_profile a single read policy and tenant_feature_events and platform_audit_log none', async () => {
    const policies = await sql`
      SELECT tablename AS table, policyname AS policy, permissive, roles, cmd,
             qual, with_check AS check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ${sql([...PLATFORM_MANAGED_TABLES])}
      ORDER BY tablename`;
    expect(policies).toEqual([
      {
        table: 'tenant_features',
        policy: tenantReadPolicyName('tenant_features'),
        permissive: 'PERMISSIVE',
        roles: ['public'],
        cmd: 'SELECT',
        qual: SAME_TENANT,
        check: null,
      },
      {
        table: 'tenant_profile',
        policy: tenantReadPolicyName('tenant_profile'),
        permissive: 'PERMISSIVE',
        roles: ['public'],
        cmd: 'SELECT',
        qual: SAME_TENANT,
        check: null,
      },
    ]);
  });

  it('applies the policies to the app role on the migrated schema', async () => {
    const tenants = ['org_rls_a', 'org_rls_b'];
    for (const id of tenants) {
      await sql`INSERT INTO organization (id, name, slug, created_at) VALUES (${id}, ${id}, ${id}, now())`;
      await sql`INSERT INTO clients (tenant_id, name) VALUES (${id}, ${id})`;
    }
    const app = postgres(withDatabase(name, { name: TEST_APP_ROLE, password: TEST_APP_PASSWORD }), {
      max: 1,
      onnotice: () => {},
    });
    try {
      const unset = await app`SELECT tenant_id FROM clients`;
      const scoped = await app.begin(async (tx) => {
        await tx`SELECT set_config('app.tenant_id', ${tenants[0]!}, true)`;
        return tx`SELECT tenant_id FROM clients`;
      });
      expect(unset).toHaveLength(0);
      expect(scoped.map((r) => r['tenant_id'])).toEqual([tenants[0]]);
    } finally {
      await app.end();
    }
  });

  it('lets the app role read its tenant_features but write neither feature table', async () => {
    const tenant = 'org_rls_features';
    await sql`INSERT INTO organization (id, name, slug, created_at) VALUES (${tenant}, ${tenant}, ${tenant}, now())`;
    const platform = postgres(
      withDatabase(name, { name: TEST_PLATFORM_ROLE, password: TEST_PLATFORM_PASSWORD }),
      { max: 1, onnotice: () => {} },
    );
    const app = postgres(withDatabase(name, { name: TEST_APP_ROLE, password: TEST_APP_PASSWORD }), {
      max: 1,
      onnotice: () => {},
    });
    try {
      await platform`INSERT INTO tenant_features (tenant_id, feature_key) VALUES (${tenant}, 'quotes')`;
      const asTenant = <T>(fn: (tx: postgres.TransactionSql) => Promise<T>) =>
        app.begin(async (tx) => {
          await tx`SELECT set_config('app.tenant_id', ${tenant}, true)`;
          return fn(tx);
        }) as Promise<T>;

      const seen = await asTenant((tx) => tx`SELECT feature_key FROM tenant_features`);
      expect(seen.map((r) => r['feature_key'])).toEqual(['quotes']);
      await expect(
        asTenant(
          (tx) =>
            tx`INSERT INTO tenant_features (tenant_id, feature_key) VALUES (${tenant}, 'events')`,
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        asTenant(
          (tx) => tx`
            INSERT INTO tenant_feature_events (tenant_id, feature_key, action, actor)
            VALUES (${tenant}, 'quotes', 'enabled', 'app')`,
        ),
      ).rejects.toThrow(/row-level security/);
    } finally {
      await app.end();
      await platform.end();
    }
  });
});
