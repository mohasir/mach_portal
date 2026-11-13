import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  TEST_APP_PASSWORD,
  TEST_APP_ROLE,
  TEST_PLATFORM_PASSWORD,
  TEST_PLATFORM_ROLE,
  testAppDatabaseUrl,
  testPlatformDatabaseUrl,
} from '../../../test/roles';
import { assertAppRoleRestricted } from '../roleGuard';
import { ensureRoles } from '../roles';

const adminUrl = process.env['TEST_DATABASE_URL']!;

type RoleRow = { rolname: string; rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean };

describe('ensureRoles', () => {
  let admin: postgres.Sql;
  let ownerRole: string;

  beforeAll(async () => {
    admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
    const [row] = await admin<{ user: string }[]>`SELECT current_user AS "user"`;
    ownerRole = row!.user;
  });
  afterAll(async () => {
    await admin.end();
  });

  const run = () =>
    ensureRoles(admin, {
      appPassword: TEST_APP_PASSWORD,
      platformPassword: TEST_PLATFORM_PASSWORD,
      ownerRole,
      appRole: TEST_APP_ROLE,
      platformRole: TEST_PLATFORM_ROLE,
    });

  it('creates a restricted app role and a platform role that bypasses RLS', async () => {
    await run();
    const rows = await admin<RoleRow[]>`
      SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles
      WHERE rolname IN (${TEST_APP_ROLE}, ${TEST_PLATFORM_ROLE})
      ORDER BY rolname`;
    expect(rows).toEqual([
      { rolname: TEST_APP_ROLE, rolsuper: false, rolbypassrls: false, rolcanlogin: true },
      { rolname: TEST_PLATFORM_ROLE, rolsuper: false, rolbypassrls: true, rolcanlogin: true },
    ]);
  });

  it('is idempotent', async () => {
    await run();
    await expect(run()).resolves.toBeUndefined();
  });

  it('lets the app role read and write existing and future tables', async () => {
    await run();
    await admin.unsafe('DROP TABLE IF EXISTS roles_test_future');
    await admin.unsafe('CREATE TABLE roles_test_future (id serial PRIMARY KEY, label text)');
    const app = postgres(testAppDatabaseUrl(), { max: 1 });
    try {
      await app`INSERT INTO roles_test_future (label) VALUES ('x')`;
      const [row] = await app<{ n: number }[]>`SELECT count(*)::int AS n FROM roles_test_future`;
      expect(row!.n).toBe(1);
      await app`SELECT count(*) FROM "organization"`;
    } finally {
      await app.end();
      await admin.unsafe('DROP TABLE IF EXISTS roles_test_future');
    }
  });
});

describe('assertAppRoleRestricted', () => {
  it('rejects a superuser connection pointing to db:roles', async () => {
    const admin = postgres(adminUrl, { max: 1 });
    try {
      await expect(assertAppRoleRestricted(admin)).rejects.toThrow(/db:roles/);
    } finally {
      await admin.end();
    }
  });

  it('rejects a role with BYPASSRLS', async () => {
    const platform = postgres(testPlatformDatabaseUrl(), { max: 1 });
    try {
      await expect(assertAppRoleRestricted(platform)).rejects.toThrow(/db:roles/);
    } finally {
      await platform.end();
    }
  });

  it('rejects a role that is a member of a BYPASSRLS role (it could SET ROLE to it)', async () => {
    const memberRole = 'mach_test_guard_member';
    const password = 'mach_test_guard_member_password';
    const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`DROP ROLE IF EXISTS ${memberRole}`);
    await admin.unsafe(`CREATE ROLE ${memberRole} LOGIN PASSWORD '${password}'`);
    await admin.unsafe(`GRANT ${TEST_PLATFORM_ROLE} TO ${memberRole}`);
    const url = new URL(adminUrl);
    url.username = memberRole;
    url.password = password;
    const member = postgres(url.toString(), { max: 1 });
    try {
      await expect(assertAppRoleRestricted(member)).rejects.toThrow(
        `is a member of "${TEST_PLATFORM_ROLE}" (BYPASSRLS)`,
      );
    } finally {
      await member.end();
      await admin.unsafe(`DROP ROLE IF EXISTS ${memberRole}`);
      await admin.end();
    }
  });

  it('rejects a role with CREATEROLE (it could grant itself a BYPASSRLS role)', async () => {
    const creatorRole = 'mach_test_guard_creator';
    const password = 'mach_test_guard_creator_password';
    const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`DROP ROLE IF EXISTS ${creatorRole}`);
    await admin.unsafe(`CREATE ROLE ${creatorRole} LOGIN CREATEROLE PASSWORD '${password}'`);
    const url = new URL(adminUrl);
    url.username = creatorRole;
    url.password = password;
    const creator = postgres(url.toString(), { max: 1 });
    try {
      await expect(assertAppRoleRestricted(creator)).rejects.toThrow(
        `role "${creatorRole}" has CREATEROLE`,
      );
    } finally {
      await creator.end();
      await admin.unsafe(`DROP ROLE IF EXISTS ${creatorRole}`);
      await admin.end();
    }
  });

  it('accepts the app role', async () => {
    const app = postgres(testAppDatabaseUrl(), { max: 1 });
    try {
      await expect(assertAppRoleRestricted(app)).resolves.toBeUndefined();
    } finally {
      await app.end();
    }
  });
});

describe('db:roles', () => {
  const API_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
  const APP_ROLE = 'mach_test_url_app';
  const PLATFORM_ROLE = 'mach_test_url_platform';
  // Characters that must be percent-encoded in a URL and that a naive split would mangle.
  const PASSWORD = `p@ss:w/rd%?#&= é'"\\`;

  const urlAs = (user: string, password: string) => {
    const url = new URL(adminUrl);
    url.username = encodeURIComponent(user);
    url.password = encodeURIComponent(password);
    return url.toString();
  };

  const runScript = (env: Record<string, string>) =>
    spawnSync('pnpm', ['exec', 'tsx', 'src/db/scripts/roles.ts'], {
      cwd: API_ROOT,
      env: { ...process.env, DATABASE_OWNER_URL: adminUrl, ...env },
      encoding: 'utf8',
    });

  const dropRoles = async () => {
    const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
    try {
      for (const role of [APP_ROLE, PLATFORM_ROLE]) {
        const [exists] = await admin`SELECT 1 FROM pg_roles WHERE rolname = ${role}`;
        if (exists) await admin.unsafe(`DROP OWNED BY ${role}; DROP ROLE ${role}`);
      }
    } finally {
      await admin.end();
    }
  };

  beforeAll(dropRoles);
  afterAll(dropRoles);

  it('creates the roles named in the URLs, which then log in with those same URLs', async () => {
    const appUrl = urlAs(APP_ROLE, PASSWORD);
    const platformUrl = urlAs(PLATFORM_ROLE, PASSWORD);
    const result = runScript({ DATABASE_APP_URL: appUrl, DATABASE_PLATFORM_URL: platformUrl });
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status, output).toBe(0);
    expect(output).toContain(`"${APP_ROLE}"`);
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain(encodeURIComponent(PASSWORD));

    for (const [url, role] of [
      [appUrl, APP_ROLE],
      [platformUrl, PLATFORM_ROLE],
    ] as const) {
      const sql = postgres(url, { max: 1 });
      try {
        const [row] = await sql<{ who: string }[]>`SELECT current_user AS who`;
        expect(row!.who).toBe(role);
      } finally {
        await sql.end();
      }
    }
  });

  it('fails naming the variable without a password, printing neither URL nor secret', () => {
    const result = runScript({
      DATABASE_APP_URL: urlAs(APP_ROLE, 'secret-value'),
      DATABASE_PLATFORM_URL: urlAs(PLATFORM_ROLE, ''),
    });
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('DATABASE_PLATFORM_URL must include a user and a password');
    expect(output).not.toContain('secret-value');
    expect(output).not.toContain(new URL(adminUrl).host);
  });
});
