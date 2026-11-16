import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { ROLE_TEMPLATES } from '@repo/guards';
import {
  allowMembersWithoutRole,
  createTestTenant,
  createTestUser,
  requireMemberRole,
  resetDb,
  testDb,
} from '../../../test/db';

const drizzleDir = join(__dirname, '../../../../drizzle');
const file = readdirSync(drizzleDir).find((f) => /^0003_.*\.sql$/.test(f));
const migrationSql = file ? readFileSync(join(drizzleDir, file), 'utf8') : '';

async function insertLegacyMember(tenantId: string, legacyRole: string): Promise<string> {
  const user = await createTestUser();
  const id = randomUUID();
  await testDb.execute(sql`
    INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
    VALUES (${id}, ${tenantId}, ${user.id}, ${legacyRole}, now())
  `);
  return id;
}

const runMigration = () => testDb.execute(sql.raw(migrationSql));

// Resources added to the templates after 0003; their migration grants them to existing roles
// (0009: unit_of_measure, see migration.0009.int.test.ts).
const GRANTED_BY_LATER_MIGRATIONS = ['unit_of_measure'];

// Drizzle wraps the driver error, so the RAISE message sits on the cause.
async function migrationError(): Promise<string | undefined> {
  const error = (await runMigration().then(
    () => undefined,
    (e: unknown) => e,
  )) as { cause?: { message?: string } } | undefined;
  return error?.cause?.message;
}

const count = async (table: string) =>
  (await testDb.execute<{ n: number }>(sql.raw(`SELECT count(*)::int AS n FROM "${table}"`)))[0]!.n;

async function snapshot() {
  const roles = await testDb.execute(sql`SELECT * FROM role ORDER BY id`);
  const perms = await testDb.execute(
    sql`SELECT * FROM role_permission ORDER BY role_id, resource, action`,
  );
  const members = await testDb.execute(sql`SELECT id, role_id FROM member ORDER BY id`);
  return { roles, perms, members };
}

async function permissionsOf(tenantId: string, name: string): Promise<string[]> {
  const rows = await testDb.execute<{ k: string }>(sql`
    SELECT p.resource || ':' || p.action || ':' || p.scope AS k
    FROM role_permission p JOIN role r ON r.id = p.role_id
    WHERE r.tenant_id = ${tenantId} AND r.name = ${name}`);
  return rows.map((r) => r.k).sort();
}

describe('0003 roles backfill', () => {
  beforeAll(allowMembersWithoutRole);
  afterAll(requireMemberRole);

  beforeEach(async () => {
    await resetDb();
  });

  it('ships a 0003 data migration', () => {
    expect(file).toBeDefined();
  });

  it('seeds roles per organization and assigns every member its role', async () => {
    const a = await createTestTenant('ta');
    const b = await createTestTenant('tb');
    const members: [string, string, string][] = [];
    for (const t of [a, b]) {
      for (const key of ['superadmin', 'admin', 'operator', 'member']) {
        members.push([await insertLegacyMember(t.id, key), t.id, key]);
      }
    }
    await runMigration();
    for (const [id, tenantId, key] of members) {
      const [row] = await testDb.execute<{
        tenant_id: string;
        name: string;
        is_owner: boolean;
      }>(sql`
        SELECT r.tenant_id, r.name, r.is_owner FROM member m JOIN role r ON r.id = m.role_id
        WHERE m.id = ${id}`);
      const tpl = ROLE_TEMPLATES.find((r) => r.key === key)!;
      expect(row).toEqual({ tenant_id: tenantId, name: tpl.name, is_owner: tpl.isOwner });
    }
  });

  it('stores each role permissions equal to ROLE_TEMPLATES', async () => {
    const t = await createTestTenant('ta');
    await runMigration();
    for (const tpl of ROLE_TEMPLATES) {
      const expected = tpl.permissions
        .filter((p) => !GRANTED_BY_LATER_MIGRATIONS.includes(p.resource))
        .map((p) => `${p.resource}:${p.action}:${p.scope}`)
        .sort();
      expect(await permissionsOf(t.id, tpl.name)).toEqual(expected);
    }
  });

  it('is idempotent and leaves roles, permissions and members unchanged', async () => {
    const t = await createTestTenant('ta');
    await insertLegacyMember(t.id, 'admin');
    await insertLegacyMember(t.id, 'superadmin');
    await runMigration();
    const first = await snapshot();
    await runMigration();
    expect(await snapshot()).toEqual(first);
    expect(await count('role')).toBe(4);
  });

  it('seeds roles for an organization without members', async () => {
    await createTestTenant('empty');
    await runMigration();
    expect(await count('role')).toBe(4);
  });

  it('does not reseed an organization that already has roles', async () => {
    const t = await createTestTenant('ta');
    await testDb.execute(sql`
      INSERT INTO "role" ("tenant_id", "name") VALUES (${t.id}, 'Admin')`);
    const memberId = await insertLegacyMember(t.id, 'admin');
    await runMigration();
    expect(await count('role')).toBe(1);
    expect(await count('role_permission')).toBe(0);
    const [row] = await testDb.execute<{ name: string }>(sql`
      SELECT r.name FROM member m JOIN role r ON r.id = m.role_id WHERE m.id = ${memberId}`);
    expect(row!.name).toBe('Admin');
  });

  it('leaves another organization untouched when only one needs the backfill', async () => {
    const a = await createTestTenant('ta');
    const b = await createTestTenant('tb');
    await testDb.execute(sql`
      INSERT INTO "role" ("tenant_id", "name") VALUES (${b.id}, 'Custom')`);
    await insertLegacyMember(a.id, 'member');
    await runMigration();
    const rolesOfB = await testDb.execute<{ name: string }>(sql`
      SELECT name FROM role WHERE tenant_id = ${b.id}`);
    expect(rolesOfB.map((r) => r.name)).toEqual(['Custom']);
    expect(await permissionsOf(b.id, 'Custom')).toEqual([]);
    expect(await count('role')).toBe(5);
  });

  it('fails clearly on an unknown member role and applies nothing', async () => {
    const t = await createTestTenant('ta');
    await insertLegacyMember(t.id, 'admin');
    await insertLegacyMember(t.id, 'wizard');
    expect(await migrationError()).toMatch(/unknown member role.*"wizard"/);
    expect(await count('role')).toBe(0);
  });

  it('fails on a comma-separated member role instead of picking one', async () => {
    const t = await createTestTenant('ta');
    await insertLegacyMember(t.id, 'admin,superadmin');
    expect(await migrationError()).toMatch(/unknown member role.*"admin,superadmin"/);
  });

  it('cannot meet a NULL member.role because the column is NOT NULL', async () => {
    const t = await createTestTenant('ta');
    const user = await createTestUser();
    const error = await testDb
      .execute(
        sql`INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
            VALUES (${randomUUID()}, ${t.id}, ${user.id}, NULL, now())`,
      )
      .then(
        () => undefined,
        (e: unknown) => e as { cause?: { code?: string } },
      );
    expect(error?.cause?.code).toBe('23502');
  });

  it('fails when the existing roles of an organization do not include the base role of a member', async () => {
    const t = await createTestTenant('ta');
    await testDb.execute(sql`
      INSERT INTO "role" ("tenant_id", "name") VALUES (${t.id}, 'Custom')`);
    await insertLegacyMember(t.id, 'admin');
    expect(await migrationError()).toMatch(
      /1 member\(s\) belong to an organization whose existing roles/,
    );
    const [row] = await testDb.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM member WHERE role_id IS NOT NULL`);
    expect(row!.n).toBe(0);
  });
});
