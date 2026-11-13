import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Role } from '@repo/guards';
import { db as defaultDb, type Executor } from '../index';
import { member, user } from '../schema';
import { auth } from '../../lib/auth';
import { legacyMemberRole, seedTenantRoles } from '../../lib/rbac/seedTenantRoles';

const SEED_PASSWORD = process.env['SEED_PASSWORD'] ?? 'admin123*';

export interface SeedUser {
  name: string;
  email: string;
  role: Role;
}

// Creates the global account when it does not exist yet. Accounts go through Better Auth so the
// password is hashed and the `credential` account row exists; a raw insert could not sign in.
// Runs outside any transaction because sign-up takes its own pool connection.
export async function ensureAccount(
  u: SeedUser,
  extra: { isPlatformAdmin?: boolean } = {},
  db: Executor = defaultDb,
): Promise<{ id: string; created: boolean }> {
  const email = u.email.toLowerCase();
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) {
    if (extra.isPlatformAdmin !== undefined) {
      await db
        .update(user)
        .set({ isPlatformAdmin: extra.isPlatformAdmin })
        .where(eq(user.id, existing.id));
    }
    return { id: existing.id, created: false };
  }

  const { user: created } = await auth.api.signUpEmail({
    body: { name: u.name, email, password: SEED_PASSWORD },
  });
  await db
    .update(user)
    .set({ isPlatformAdmin: extra.isPlatformAdmin ?? false })
    .where(eq(user.id, created.id));
  return { id: created.id, created: true };
}

// `roleIds` are the tenant's role ids by key; they are resolved from the tenant itself when omitted.
export async function ensureMembership(
  userId: string,
  tenantId: string,
  roleKey: Role,
  roleIds?: Record<Role, string>,
  db: Executor = defaultDb,
) {
  const [existing] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, tenantId)))
    .limit(1);
  if (existing) return false;
  const ids = roleIds ?? (await seedTenantRoles(tenantId, db));
  await db.insert(member).values({
    id: randomUUID(),
    userId,
    role: legacyMemberRole(roleKey),
    roleId: ids[roleKey],
    createdAt: new Date(),
    organizationId: tenantId,
  });
  return true;
}

export async function seedUsers(tenantId: string, users: SeedUser[], db: Executor = defaultDb) {
  console.log('👤 Seeding usuarios...');
  const roleIds = await seedTenantRoles(tenantId, db);
  for (const u of users) {
    const account = await ensureAccount(u, {}, db);
    const added = await ensureMembership(account.id, tenantId, u.role, roleIds, db);
    console.log(
      `  ${account.created || added ? '✅' : '⏭️ '} ${u.email} (${u.role})${account.created ? '' : ' — cuenta existente'}`,
    );
  }
}
