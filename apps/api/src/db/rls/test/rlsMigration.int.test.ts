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
import { tenantPolicyName } from '../policy';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const RLS_TABLES = [...TENANT_TABLES, 'platform_access_log'].sort();

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
    for (const row of rows) expect(row, row.table).toMatchObject({ enabled: true, forced: true });
  });

  it('gives every tenant table its isolation policy and no other', async () => {
    const policies = await sql<
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
    expect(policies.map((p) => p.table)).toEqual(RLS_TABLES);
    const expr = "(tenant_id = current_setting('app.tenant_id'::text, true))";
    for (const p of policies) {
      expect(p, p.table).toEqual({
        table: p.table,
        policy: tenantPolicyName(p.table),
        permissive: 'PERMISSIVE',
        roles: ['public'],
        cmd: 'ALL',
        qual: expr,
        check: expr,
      });
    }
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
});
