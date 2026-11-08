import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { addMember, createTestTenant, createTestUser, resetDb, testDb } from '../../../test/db';

// Drizzle wraps the driver error, so the Postgres code sits somewhere on the cause chain.
async function pgCodes(run: () => Promise<unknown>): Promise<unknown[]> {
  const error = await run().then(
    () => undefined,
    (e: unknown) => e,
  );
  const codes: unknown[] = [];
  for (let e = error as { code?: unknown; cause?: unknown } | undefined; e; e = e.cause as never)
    codes.push(e.code);
  return codes;
}

async function insertRole(tenantId: string, name: string, isOwner = false): Promise<string> {
  const id = randomUUID();
  await testDb.execute(sql`
    INSERT INTO "role" ("id", "tenant_id", "name", "is_owner")
    VALUES (${id}, ${tenantId}, ${name}, ${isOwner})
  `);
  return id;
}

describe('roles schema', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects two roles with the same name in one tenant', async () => {
    const t = await createTestTenant('t1');
    await insertRole(t.id, 'Admin');
    expect(await pgCodes(() => insertRole(t.id, 'Admin'))).toContain('23505');
  });

  it('allows the same role name in different tenants', async () => {
    const a = await createTestTenant('ta');
    const b = await createTestTenant('tb');
    await insertRole(a.id, 'Admin');
    await expect(insertRole(b.id, 'Admin')).resolves.toBeTruthy();
  });

  it('allows a single owner role per tenant', async () => {
    const a = await createTestTenant('ta');
    const b = await createTestTenant('tb');
    await insertRole(a.id, 'Owner', true);
    expect(await pgCodes(() => insertRole(a.id, 'Owner 2', true))).toContain('23505');
    await expect(insertRole(a.id, 'Other')).resolves.toBeTruthy();
    await expect(insertRole(b.id, 'Owner', true)).resolves.toBeTruthy();
  });

  it('defaults version to 1 and scope to all, and cascades permissions on role delete', async () => {
    const t = await createTestTenant('t1');
    const roleId = await insertRole(t.id, 'Admin');
    await testDb.execute(sql`
      INSERT INTO "role_permission" ("role_id", "tenant_id", "resource", "action")
      VALUES (${roleId}, ${t.id}, 'events', 'list')
    `);
    const rows = await testDb.execute<{ scope: string; version: number }>(sql`
      SELECT rp."scope", r."version" FROM "role_permission" rp JOIN "role" r ON r."id" = rp."role_id"
    `);
    expect(rows[0]).toMatchObject({ scope: 'all', version: 1 });

    await testDb.execute(sql`DELETE FROM "role" WHERE "id" = ${roleId}`);
    const left = await testDb.execute(sql`SELECT 1 FROM "role_permission"`);
    expect(left).toHaveLength(0);
  });

  it('restricts deleting a role that has a member assigned', async () => {
    const t = await createTestTenant('t1');
    const roleId = await insertRole(t.id, 'Admin');
    const user = await createTestUser();
    await addMember(user.id, t.id);
    await testDb.execute(
      sql`UPDATE "member" SET "role_id" = ${roleId} WHERE "user_id" = ${user.id}`,
    );
    expect(
      await pgCodes(() => testDb.execute(sql`DELETE FROM "role" WHERE "id" = ${roleId}`)),
    ).toContain('23001');
  });

  it('keeps member.role_id nullable and stores audit rows with a nullable role', async () => {
    const t = await createTestTenant('t1');
    const user = await createTestUser();
    await addMember(user.id, t.id);
    await testDb.execute(sql`
      INSERT INTO "role_audit_log" ("id", "tenant_id", "actor_user_id", "action", "after")
      VALUES (${randomUUID()}, ${t.id}, ${user.id}, 'role.create', '{"a":1}'::jsonb)
    `);
    const rows = await testDb.execute(sql`SELECT "role_id" FROM "role_audit_log"`);
    expect(rows[0]?.role_id).toBeNull();
  });
});
