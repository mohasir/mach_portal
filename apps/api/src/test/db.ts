import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { resetPlatformAccessSessions } from '../core/trpc/platformAccess';
import { db, type Database } from '../db';
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
  role: string = 'member',
): Promise<void> {
  await testDb.execute(sql`
    INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
    VALUES (${randomUUID()}, ${tenantId}, ${userId}, ${role}, now())
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
