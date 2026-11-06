import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Role } from '@repo/guards';
import { db } from '../index';
import { member, user } from '../schema';
import { auth } from '../../lib/auth';

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
  // Sign-up assigns the default role; the global role is what authorizes.
  await db
    .update(user)
    .set({ role: u.role, isPlatformAdmin: extra.isPlatformAdmin ?? false })
    .where(eq(user.id, created.id));
  return { id: created.id, created: true };
}

export async function ensureMembership(userId: string, tenantId: string, role: Role) {
  const [existing] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, tenantId)))
    .limit(1);
  if (existing) return false;
  await db
    .insert(member)
    .values({ id: randomUUID(), userId, role, createdAt: new Date(), organizationId: tenantId });
  return true;
}

// An account that already exists keeps its global role: another tenant may depend on it.
export async function seedUsers(tenantId: string, users: SeedUser[]) {
  console.log('👤 Seeding usuarios...');
  for (const u of users) {
    const account = await ensureAccount(u);
    const added = await ensureMembership(account.id, tenantId, u.role);
    console.log(
      `  ${account.created || added ? '✅' : '⏭️ '} ${u.email} (${u.role})${account.created ? '' : ' — cuenta existente'}`,
    );
  }
}
