import postgres from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../../test/db';
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
