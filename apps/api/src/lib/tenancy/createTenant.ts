import { randomBytes, randomUUID } from 'node:crypto';
import { and, eq, like, notExists, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { ROLES } from '@repo/guards';
import { CATALOG_KINDS, isCatalogKind } from '@repo/schemas';
import type { Database } from '../../db';
import { member, organization, tenantProfile, user, verification } from '../../db/schema';
import { seedTenantDefaults } from '../../db/seeds/defaults';
import { lockUserEmail } from '../../db/locks';
import { env } from '../../env';
import { auth } from '../auth';
import { legacyMemberRole, seedTenantRoles } from '../rbac/seedTenantRoles';
import { AppError, ErrorCodes, isPgError, PG_UNIQUE_VIOLATION } from '../errors';
import { isValidSlug, normalizeSlug } from './slug';

const PASSWORD_SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type CreateTenantInput = {
  slug: string;
  name: string;
  adminEmail: string;
  adminName: string;
  // Defaults to the products catalog when omitted.
  catalogKind?: string;
};

export type CreateTenantResult = { tenantId: string; setupUrl: string | null };

const badRequest = (
  code: typeof ErrorCodes.tenant.INVALID_SLUG | typeof ErrorCodes.tenant.INVALID_INPUT,
) => new TRPCError({ code: 'BAD_REQUEST', cause: new AppError(code) });

const slugTaken = () =>
  new TRPCError({
    code: 'CONFLICT',
    cause: new AppError(ErrorCodes.tenant.SLUG_TAKEN),
  });

async function findAccountId(database: Database, email: string) {
  const [row] = await database
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  return row?.id;
}

// Better Auth hashes a random password that is thrown away; the admin sets the real one through
// the setup link. A sign-up that loses a race for the same email reuses the winner's account.
async function provisionAccount(database: Database, email: string, name: string) {
  const existing = await findAccountId(database, email);
  if (existing) return { id: existing, created: false };
  try {
    const { user: created } = await auth.api.signUpEmail({
      body: { name, email, password: randomBytes(32).toString('hex') },
    });
    return { id: created.id, created: true };
  } catch (error) {
    const raced = await findAccountId(database, email);
    if (raced) return { id: raced, created: false };
    throw error;
  }
}

// A platform-level action: an email that already has an account is attached as admin with its
// password and `mustChangePassword` untouched (no link is issued for it).
//
// Better Auth's sign-up takes its own pool connection, so it runs before the transaction and
// never while one is held: enough concurrent calls would otherwise fill the pool with waiting
// transactions. Everything tenant-related is then written in one transaction, and an account
// created by this call is removed again if that transaction fails (unless it has a membership).
//
// It writes a tenant's rows before any request has that tenant set, so `database` must be a role
// that bypasses Row Level Security (the platform client); under `app` every tenant insert fails.
export async function createTenant(
  input: CreateTenantInput,
  database: Database,
): Promise<CreateTenantResult> {
  const slug = normalizeSlug(input.slug);
  if (!isValidSlug(slug)) throw badRequest(ErrorCodes.tenant.INVALID_SLUG);
  const name = input.name.trim();
  const adminName = input.adminName.trim();
  const email = input.adminEmail.trim().toLowerCase();
  if (!name || !adminName || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw badRequest(ErrorCodes.tenant.INVALID_INPUT);
  }

  const [taken] = await database
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  if (taken) throw slugTaken();

  // A member is not audited when it accesses the tenant, so a platform admin must not become one.
  const [existingAccount] = await database
    .select({ isPlatformAdmin: user.isPlatformAdmin })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (existingAccount?.isPlatformAdmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: new AppError(ErrorCodes.user.IS_PLATFORM_ADMIN),
    });
  }

  if (input.catalogKind !== undefined && !isCatalogKind(input.catalogKind)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      cause: new AppError(
        ErrorCodes.tenant.UNKNOWN_CATALOG_KIND,
        `Unknown catalog kind "${input.catalogKind}". Known: ${CATALOG_KINDS.join(', ')}`,
      ),
    });
  }

  const account = await provisionAccount(database, email, adminName);

  try {
    const { tenantId, token } = await database.transaction(async (tx) => {
      await lockUserEmail(tx, email);
      const tenantId = randomUUID();
      await tx.insert(organization).values({ id: tenantId, name, slug, createdAt: new Date() });
      await seedTenantDefaults(tenantId, tx);
      if (input.catalogKind !== undefined && isCatalogKind(input.catalogKind)) {
        await tx.insert(tenantProfile).values({ tenantId, catalogKind: input.catalogKind });
      }

      const roleIds = await seedTenantRoles(tenantId, tx);
      await tx.insert(member).values({
        id: randomUUID(),
        userId: account.id,
        role: legacyMemberRole(ROLES.SUPERADMIN),
        roleId: roleIds[ROLES.SUPERADMIN],
        createdAt: new Date(),
        organizationId: tenantId,
      });

      if (!account.created) return { tenantId, token: null };

      await tx.update(user).set({ mustChangePassword: true }).where(eq(user.id, account.id));
      await tx
        .delete(verification)
        .where(
          and(
            eq(verification.value, account.id),
            like(verification.identifier, 'reset-password:%'),
          ),
        );
      // Same `reset-password:<token>` identifier Better Auth's /reset-password consumes.
      const token = randomBytes(24).toString('hex');
      await tx.insert(verification).values({
        id: randomUUID(),
        identifier: `reset-password:${token}`,
        value: account.id,
        expiresAt: new Date(Date.now() + PASSWORD_SETUP_TOKEN_TTL_MS),
      });
      return { tenantId, token };
    });

    return {
      tenantId,
      setupUrl: token ? `${env.WEB_APP_URL}/set-password?token=${token}&reason=create` : null,
    };
  } catch (error) {
    if (account.created) {
      await database
        .transaction(async (tx) => {
          await lockUserEmail(tx, email);
          await tx.delete(user).where(
            and(
              eq(user.id, account.id),
              notExists(
                tx
                  .select({ one: sql`1` })
                  .from(member)
                  .where(eq(member.userId, user.id)),
              ),
            ),
          );
        })
        .catch((cleanupErr) => console.error('tenant create cleanup failed', cleanupErr));
    }
    if (isPgError(error, PG_UNIQUE_VIOLATION, 'slug')) throw slugTaken();
    throw error;
  }
}
