import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  addMember,
  allowMembersWithoutRole,
  createTestTenant,
  createTestUser,
  requireMemberRole,
  resetDb,
  testDb,
} from '../../../test/db';
import { verifyMultitenant } from '../verifyMultitenant';

const url = process.env['TEST_DATABASE_URL']!;

// Fixtures create no app_settings, so that problem is expected next to the role ones.
const settingsProblem = (slug: string) => `organization: 1 without app_settings (${slug})`;

async function problemsOf(options?: { pre?: boolean }): Promise<string[]> {
  return (await verifyMultitenant(url, options)).problems;
}

describe('verifyMultitenant role checks', () => {
  beforeAll(allowMembersWithoutRole);
  afterAll(requireMemberRole);

  beforeEach(async () => {
    await resetDb();
  });

  it('reports nothing for members linked to their organization roles', async () => {
    const t = await createTestTenant('ta');
    await addMember((await createTestUser()).id, t.id, 'superadmin');
    await addMember((await createTestUser()).id, t.id, 'member');
    expect(await problemsOf()).toEqual([settingsProblem('ta')]);
  });

  it('reports a member without role_id', async () => {
    const t = await createTestTenant('ta');
    await addMember((await createTestUser()).id, t.id, 'superadmin');
    await testDb.execute(sql`
      INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
      VALUES (${randomUUID()}, ${t.id}, ${(await createTestUser()).id}, 'member', now())`);
    expect(await problemsOf()).toEqual(['member: 1 row(s) without role_id', settingsProblem('ta')]);
  });

  it('reports a member whose role belongs to another organization', async () => {
    const a = await createTestTenant('ta');
    const b = await createTestTenant('tb');
    await addMember((await createTestUser()).id, a.id, 'superadmin');
    await addMember((await createTestUser()).id, b.id, 'superadmin');
    await testDb.execute(sql`
      UPDATE "member" SET role_id = (SELECT id FROM "role" WHERE tenant_id = ${b.id} AND name = 'Member')
      WHERE organization_id = ${a.id}`);
    expect(await problemsOf()).toEqual([
      'member: 1 row(s) whose role belongs to another organization',
      'organization: 1 without an owner role that has a member (ta)',
      'organization: 2 without app_settings (ta, tb)',
    ]);
  });

  it('reports an organization whose owner role has no member', async () => {
    const t = await createTestTenant('ta');
    await addMember((await createTestUser()).id, t.id, 'admin');
    expect(await problemsOf()).toEqual([
      'organization: 1 without an owner role that has a member (ta)',
      settingsProblem('ta'),
    ]);
  });

  it('--pre flags a member role outside the base keys, including comma-separated ones', async () => {
    const t = await createTestTenant('ta');
    for (const legacyRole of ['admin,superadmin', 'wizard', 'operator']) {
      const user = await createTestUser({ email: `${legacyRole.replace(',', '-')}@x.test` });
      await testDb.execute(sql`
        INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
        VALUES (${randomUUID()}, ${t.id}, ${user.id}, ${legacyRole}, now())`);
    }
    const msg = (who: string, r: string) =>
      `member ${who}: role "${r}" is not one of superadmin|admin|operator|member; the roles migration would refuse it`;
    expect(await problemsOf({ pre: true })).toEqual([
      msg('admin-superadmin@x.test', 'admin,superadmin'),
      msg('wizard@x.test', 'wizard'),
    ]);
  });

  it('--pre warns about organizations whose members hold no legacy superadmin role', async () => {
    const legacyMember = async (tenantId: string, role: string) =>
      testDb.execute(sql`
        INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
        VALUES (${randomUUID()}, ${tenantId}, ${(await createTestUser()).id}, ${role}, now())`);
    const withOwner = await createTestTenant('owned');
    await legacyMember(withOwner.id, 'superadmin');
    await legacyMember(withOwner.id, 'admin');
    const adminOnly = await createTestTenant('admin-only');
    await legacyMember(adminOnly.id, 'admin');
    await createTestTenant('empty');

    const { notes, problems } = await verifyMultitenant(url, { pre: true });
    const warnings = notes.filter((n) => n.includes('no owner'));
    expect(warnings).toEqual([
      expect.stringMatching(
        /^WARNING: 2 organization\(s\) with no member whose role is "superadmin" .*: admin-only, empty\./,
      ),
    ]);
    expect(warnings[0]).toContain('users.update');
    expect(problems).toEqual([]);
  });
});
