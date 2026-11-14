import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestTenant, resetDb } from '../../../test/db';
import {
  TEST_PLATFORM_ROLE,
  testAppDatabaseUrl,
  testPlatformDatabaseUrl,
} from '../../../test/roles';
import { verifyMultitenant } from '../verifyMultitenant';

const adminUrl = process.env['TEST_DATABASE_URL']!;
const SAME_TENANT = `tenant_id = current_setting('app.tenant_id', true)`;
const MEMBER_ROLE = 'mach_test_bypass_member';
const MEMBER_PASSWORD = 'mach_test_bypass_member_password';
const CREATOR_ROLE = 'mach_test_bypass_creator';
const CREATOR_PASSWORD = 'mach_test_bypass_creator_password';

let admin: postgres.Sql;

// Puts the clients table back the way the migrations leave it, whatever a test did to it.
async function restoreClientsRls() {
  await admin.unsafe(`DROP POLICY IF EXISTS "clients_wide_open" ON "clients"`);
  await admin.unsafe(`DROP POLICY IF EXISTS "clients_tenant_isolation" ON "clients"`);
  await admin.unsafe(
    `CREATE POLICY "clients_tenant_isolation" ON "clients" AS PERMISSIVE FOR ALL TO public
     USING (${SAME_TENANT}) WITH CHECK (${SAME_TENANT})`,
  );
  await admin.unsafe(`ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY`);
  await admin.unsafe(`ALTER TABLE "clients" FORCE ROW LEVEL SECURITY`);
}

const problemsOf = async (url = adminUrl, options: { appUrl?: string } = {}) =>
  (await verifyMultitenant(url, options)).problems;

beforeAll(() => {
  admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
});

afterAll(async () => {
  await restoreClientsRls();
  await restoreFeatureRls();
  await admin.unsafe(`DROP ROLE IF EXISTS ${MEMBER_ROLE}`);
  await admin.unsafe(`DROP ROLE IF EXISTS ${CREATOR_ROLE}`);
  await admin.end();
});

beforeEach(async () => {
  await resetDb();
});

describe('verifyMultitenant row level security checks', () => {
  afterEach(restoreClientsRls);

  it('reports nothing when every tenant table has RLS enabled, forced and its policy', async () => {
    expect(await problemsOf()).toEqual([]);
  });

  it('reports a tenant table whose policy was removed', async () => {
    await admin.unsafe(`DROP POLICY "clients_tenant_isolation" ON "clients"`);
    expect(await problemsOf()).toEqual(['clients: missing policy clients_tenant_isolation']);
  });

  it('reports a policy that does not compare tenant_id with app.tenant_id', async () => {
    await admin.unsafe(`DROP POLICY "clients_tenant_isolation" ON "clients"`);
    await admin.unsafe(`CREATE POLICY "clients_tenant_isolation" ON "clients" USING (true)`);
    expect(await problemsOf()).toEqual([
      'clients: policy clients_tenant_isolation does not restrict rows to app.tenant_id (USING and WITH CHECK)',
    ]);
  });

  it('reports another permissive policy, which would widen what the isolation policy allows', async () => {
    await admin.unsafe(`CREATE POLICY "clients_wide_open" ON "clients" USING (true)`);
    expect(await problemsOf()).toEqual([
      'clients: permissive policy clients_wide_open widens the tenant isolation',
    ]);
  });

  it('reports a tenant table whose RLS is not forced or not enabled', async () => {
    await admin.unsafe(`ALTER TABLE "clients" NO FORCE ROW LEVEL SECURITY`);
    expect(await problemsOf()).toEqual(['clients: row level security is not forced']);

    await admin.unsafe(`ALTER TABLE "clients" DISABLE ROW LEVEL SECURITY`);
    expect(await problemsOf()).toEqual([
      'clients: row level security is not enabled',
      'clients: row level security is not forced',
    ]);
  });
});

// Puts the feature tables back the way the migrations leave them, whatever a test did to them.
async function restoreFeatureRls() {
  await admin.unsafe(`DROP POLICY IF EXISTS "tenant_features_write" ON "tenant_features"`);
  await admin.unsafe(
    `DROP POLICY IF EXISTS "tenant_feature_events_read" ON "tenant_feature_events"`,
  );
  await admin.unsafe(`DROP POLICY IF EXISTS "tenant_features_tenant_read" ON "tenant_features"`);
  await admin.unsafe(
    `CREATE POLICY "tenant_features_tenant_read" ON "tenant_features" AS PERMISSIVE FOR SELECT
     TO public USING (${SAME_TENANT})`,
  );
  for (const table of ['tenant_features', 'tenant_feature_events']) {
    await admin.unsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await admin.unsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
  }
}

describe('verifyMultitenant checks of the platform-managed feature tables', () => {
  afterEach(restoreFeatureRls);

  it('reports a write policy on tenant_features', async () => {
    await admin.unsafe(
      `CREATE POLICY "tenant_features_write" ON "tenant_features" FOR INSERT
       WITH CHECK (${SAME_TENANT})`,
    );
    expect(await problemsOf()).toEqual([
      'tenant_features: expected exactly the SELECT policy tenant_features_tenant_read, found tenant_features_tenant_read (SELECT), tenant_features_write (INSERT)',
    ]);
  });

  it('reports a tenant_features read policy that does not compare tenant_id', async () => {
    await admin.unsafe(`DROP POLICY "tenant_features_tenant_read" ON "tenant_features"`);
    await admin.unsafe(
      `CREATE POLICY "tenant_features_tenant_read" ON "tenant_features" FOR SELECT USING (true)`,
    );
    expect(await problemsOf()).toEqual([
      'tenant_features: policy tenant_features_tenant_read does not restrict rows to app.tenant_id',
    ]);
  });

  it('reports any policy on tenant_feature_events', async () => {
    await admin.unsafe(
      `CREATE POLICY "tenant_feature_events_read" ON "tenant_feature_events" FOR SELECT
       USING (${SAME_TENANT})`,
    );
    expect(await problemsOf()).toEqual([
      'tenant_feature_events: expected no policy, found tenant_feature_events_read (SELECT)',
    ]);
  });

  it('reports a feature table whose RLS is not forced or not enabled', async () => {
    await admin.unsafe(`ALTER TABLE "tenant_feature_events" NO FORCE ROW LEVEL SECURITY`);
    await admin.unsafe(`ALTER TABLE "tenant_features" DISABLE ROW LEVEL SECURITY`);
    expect(await problemsOf()).toEqual([
      'tenant_feature_events: row level security is not forced',
      'tenant_features: row level security is not enabled',
    ]);
  });
});

describe('verifyMultitenant with a feature table missing', () => {
  // A rename keeps the table's RLS settings, so putting it back restores the migrated state; the
  // renamed copy shows up as an unexpected tenant table, hence `toContain`.
  it.each(['tenant_features', 'tenant_feature_events'])(
    'reports a missing %s table instead of skipping it',
    async (table) => {
      await admin.unsafe(`ALTER TABLE "${table}" RENAME TO "${table}_hidden"`);
      try {
        expect(await problemsOf()).toContain(`${table}: missing table`);
      } finally {
        await admin.unsafe(`ALTER TABLE "${table}_hidden" RENAME TO "${table}"`);
      }
    },
  );
});

describe('verifyMultitenant feature data checks', () => {
  // The fixture tenants lack owners and settings, so only the feature problems are compared.
  const featureProblems = async () =>
    (await problemsOf()).filter((p) => p.startsWith('tenant_features:'));
  const insertFeature = (
    tenantId: string,
    key: string,
    { enabled = true, expiresAt = null }: { enabled?: boolean; expiresAt?: Date | null } = {},
  ) => admin`
    INSERT INTO tenant_features (tenant_id, feature_key, enabled, expires_at)
    VALUES (${tenantId}, ${key}, ${enabled}, ${expiresAt})`;

  it('reports nothing for valid feature rows', async () => {
    const tenant = await createTestTenant('ok', undefined, { features: [] });
    await insertFeature(tenant.id, 'quotes');
    await insertFeature(tenant.id, 'events');
    await insertFeature(tenant.id, 'priceTiers');
    expect(await featureProblems()).toEqual([]);
  });

  it('reports a row with a core key', async () => {
    const tenant = await createTestTenant('core', undefined, { features: [] });
    await insertFeature(tenant.id, 'clients');
    expect(await featureProblems()).toEqual([
      'tenant_features: 1 row(s) with a core or unknown feature_key (core: clients)',
    ]);
  });

  it('reports a row with an unknown key', async () => {
    const tenant = await createTestTenant('unknown', undefined, { features: [] });
    await insertFeature(tenant.id, 'warp');
    expect(await featureProblems()).toEqual([
      'tenant_features: 1 row(s) with a core or unknown feature_key (warp)',
    ]);
  });

  it('reports an organization with events active and no quotes', async () => {
    const tenant = await createTestTenant('orphan-events', undefined, { features: [] });
    await insertFeature(tenant.id, 'events');
    expect(await featureProblems()).toEqual([
      'tenant_features: 1 organization(s) with events active without quotes (orphan-events)',
    ]);
  });

  it('counts quotes that is disabled or expired as not active', async () => {
    const disabled = await createTestTenant('quotes-off', undefined, { features: [] });
    await insertFeature(disabled.id, 'quotes', { enabled: false });
    await insertFeature(disabled.id, 'events');
    const expired = await createTestTenant('quotes-expired', undefined, { features: [] });
    await insertFeature(expired.id, 'quotes', { expiresAt: new Date('2000-01-01') });
    await insertFeature(expired.id, 'events');
    expect(await featureProblems()).toEqual([
      'tenant_features: 2 organization(s) with events active without quotes (quotes-expired, quotes-off)',
    ]);
  });

  it('ignores events that is itself disabled', async () => {
    const tenant = await createTestTenant('events-off', undefined, { features: [] });
    await insertFeature(tenant.id, 'events', { enabled: false });
    expect(await featureProblems()).toEqual([]);
  });
});

describe('verifyMultitenant role checks', () => {
  it('passes when it connects as the platform role', async () => {
    expect(await problemsOf(testPlatformDatabaseUrl())).toEqual([]);
  });

  it('reports a connection that is subject to RLS, since it would only see part of the data', async () => {
    expect(await problemsOf(testAppDatabaseUrl())).toContainEqual(
      expect.stringMatching(/^connection role "mach_test_app" does not bypass RLS/),
    );
  });

  it('accepts the restricted app role as the API role', async () => {
    expect(await problemsOf(adminUrl, { appUrl: testAppDatabaseUrl() })).toEqual([]);
  });

  it('reports an API role with BYPASSRLS or superuser', async () => {
    expect(await problemsOf(adminUrl, { appUrl: testPlatformDatabaseUrl() })).toEqual([
      `API role "${TEST_PLATFORM_ROLE}" has BYPASSRLS: Row Level Security would not isolate organizations`,
    ]);
    expect(await problemsOf(adminUrl, { appUrl: adminUrl })).toEqual([
      expect.stringMatching(/^API role ".+" is a superuser/),
    ]);
  });

  it('reports an API role that is a member of a role that bypasses RLS', async () => {
    await admin.unsafe(`DROP ROLE IF EXISTS ${MEMBER_ROLE}`);
    await admin.unsafe(`CREATE ROLE ${MEMBER_ROLE} LOGIN PASSWORD '${MEMBER_PASSWORD}'`);
    await admin.unsafe(`GRANT ${TEST_PLATFORM_ROLE} TO ${MEMBER_ROLE}`);
    const url = new URL(adminUrl);
    url.username = MEMBER_ROLE;
    url.password = MEMBER_PASSWORD;

    expect(await problemsOf(adminUrl, { appUrl: url.toString() })).toEqual([
      `API role "${MEMBER_ROLE}" is a member of "${TEST_PLATFORM_ROLE}" (BYPASSRLS): Row Level Security would not isolate organizations`,
    ]);
  });

  it('reports an API role with CREATEROLE', async () => {
    await admin.unsafe(`DROP ROLE IF EXISTS ${CREATOR_ROLE}`);
    await admin.unsafe(
      `CREATE ROLE ${CREATOR_ROLE} LOGIN CREATEROLE PASSWORD '${CREATOR_PASSWORD}'`,
    );
    const url = new URL(adminUrl);
    url.username = CREATOR_ROLE;
    url.password = CREATOR_PASSWORD;

    expect(await problemsOf(adminUrl, { appUrl: url.toString() })).toEqual([
      `API role "${CREATOR_ROLE}" has CREATEROLE (it could grant itself a role that bypasses RLS): Row Level Security would not isolate organizations`,
    ]);
  });
});
