import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { resetPlatformAccessSessions } from '../core/trpc/platformAccess';
import type { RoleType } from '@repo/guards';
import { db, type Database } from '../db';
import { legacyMemberRole, seedTenantRoles } from '../lib/rbac/seedTenantRoles';
import { invalidateTenantCache } from '../lib/tenancy/tenantResolver';

export type TestTenant = { id: string; slug: string; userId: string };

export const testDb: Database = db;

// The schema is pushed once per run (globalSetup), so the table list never changes mid-run.
let truncateTarget: string | undefined;

async function tablesToTruncate(): Promise<string | undefined> {
  if (truncateTarget) return truncateTarget;
  const rows = await testDb.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  if (rows.length === 0) return undefined;
  truncateTarget = rows.map((r) => `"public"."${r.table_name}"`).join(', ');
  return truncateTarget;
}

// Also drops the in-memory caches keyed by rows that the truncate just removed.
export async function resetDb(): Promise<void> {
  invalidateTenantCache();
  resetPlatformAccessSessions();
  const tables = await tablesToTruncate();
  if (!tables) return;
  await testDb.execute(sql.raw(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`));
}

// A database between the roles backfill and the NOT NULL hardening may hold members without
// role_id. Suites that exercise that state (the backfill itself, mt:verify) relax the pushed schema
// for their duration; `requireMemberRole` empties the tables first so the constraint can return.
export async function allowMembersWithoutRole(): Promise<void> {
  await testDb.execute(sql`ALTER TABLE "member" ALTER COLUMN "role_id" DROP NOT NULL`);
}

export async function requireMemberRole(): Promise<void> {
  await resetDb();
  await testDb.execute(sql`ALTER TABLE "member" ALTER COLUMN "role_id" SET NOT NULL`);
}

// Raw SQL keeps fixtures independent of the Drizzle schema objects and of the
// Better Auth hooks that would otherwise run on inserts.
export async function createTestTenant(
  slug: string,
  name: string = slug,
): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  await testDb.execute(sql`
    INSERT INTO "organization" ("id", "name", "slug", "created_at")
    VALUES (${id}, ${name}, ${slug}, now())
  `);
  return { id, slug };
}

export async function createTestUser(
  overrides: { email?: string; role?: string; isPlatformAdmin?: boolean } = {},
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const email = overrides.email ?? `${id}@test.local`;
  await testDb.execute(sql`
    INSERT INTO "user" ("id", "name", "email", "email_verified", "role", "is_platform_admin")
    VALUES (${id}, ${email}, ${email}, true, ${overrides.role ?? 'user'}, ${overrides.isPlatformAdmin ?? false})
  `);
  return { id, email };
}

export async function addMember(
  userId: string,
  tenantId: string,
  roleKey: RoleType = 'member',
): Promise<void> {
  const roleIds = await seedTenantRoles(tenantId, testDb);
  await testDb.execute(sql`
    INSERT INTO "member" ("id", "organization_id", "user_id", "role", "role_id", "created_at")
    VALUES (${randomUUID()}, ${tenantId}, ${userId}, ${legacyMemberRole(roleKey)}, ${roleIds[roleKey]}, now())
  `);
}

// member.role_id cannot be null, so the broken link left to test is a role of another organization
// (its owner role, the strongest one to borrow). Access resolution must fail closed on it.
export async function pointMemberAtForeignRole(userId: string, tenantId: string): Promise<void> {
  const other = await createTestTenant(`foreign-${randomUUID().slice(0, 8)}`);
  const roles = await seedTenantRoles(other.id, testDb);
  await testDb.execute(sql`
    UPDATE "member" SET "role_id" = ${roles.superadmin}
    WHERE "user_id" = ${userId} AND "organization_id" = ${tenantId}
  `);
}

export async function seedTwoTenants(): Promise<{ a: TestTenant; b: TestTenant }> {
  const seed = async (slug: string): Promise<TestTenant> => {
    const tenant = await createTestTenant(slug);
    const user = await createTestUser();
    await addMember(user.id, tenant.id);
    return { ...tenant, userId: user.id };
  };
  return { a: await seed('tenant-a'), b: await seed('tenant-b') };
}

// Membership with a one-off role holding exactly `grants`, for scope and permission edge cases
// that no base role covers.
export async function addMemberWithGrants(
  userId: string,
  tenantId: string,
  grants: ReadonlyArray<readonly [resource: string, action: string, scope: 'own' | 'all']>,
): Promise<string> {
  const roleId = randomUUID();
  await testDb.execute(sql`
    INSERT INTO "role" ("id", "tenant_id", "name") VALUES (${roleId}, ${tenantId}, ${`Custom ${roleId}`})
  `);
  for (const [resource, action, scope] of grants) {
    await testDb.execute(sql`
      INSERT INTO "role_permission" ("role_id", "tenant_id", "resource", "action", "scope")
      VALUES (${roleId}, ${tenantId}, ${resource}, ${action}, ${scope})
    `);
  }
  await testDb.execute(sql`
    INSERT INTO "member" ("id", "organization_id", "user_id", "role", "role_id", "created_at")
    VALUES (${randomUUID()}, ${tenantId}, ${userId}, 'member', ${roleId}, now())
  `);
  return roleId;
}
