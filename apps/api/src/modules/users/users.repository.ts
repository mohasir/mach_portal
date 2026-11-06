import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  like,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { ROLES } from '@repo/guards';
import type { UsersListQuery } from '@repo/schemas';
import type { Database, Tx } from '../../db';
import { lockUserEmail } from '../../db/locks';
import { member, platformAccessLog, session, user, verification } from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicUserColumns } from './users.resource';
import { containsPattern } from '../../lib/utils/search';

type UserUpdate = Partial<Pick<typeof user.$inferInsert, 'name' | 'role' | 'mustChangePassword'>>;

const sortColumns = {
  name: user.name,
  email: user.email,
  role: member.role,
  createdAt: user.createdAt,
} as const;

// Users are global; this repository scopes them by MEMBERSHIP: every read joins `member` of this
// tenant, and every write to the global `user` row is limited to members of this tenant.
export class UsersRepository {
  constructor(
    private db: Database | Tx,
    private tenantId: string,
  ) {}

  private membershipJoin() {
    return and(eq(member.userId, user.id), eq(member.organizationId, this.tenantId));
  }

  private tenantMemberIds() {
    return this.db
      .select({ id: member.userId })
      .from(member)
      .where(eq(member.organizationId, this.tenantId));
  }

  private selection() {
    return {
      ...publicUserColumns,
      sessionsCount: sql<number>`(
        select count(*)::int from ${session}
        where ${session.userId} = ${user.id}
          and ${session.activeOrganizationId} = ${this.tenantId}
          and ${session.expiresAt} > now()
      )`,
    };
  }

  // Only a superadmin caller can see superadmin members in a list — everyone else (admin,
  // operator, member) never gets superadmin rows back, e.g. in the quote reassignment user picker.
  // The rule reads the tenant role, which is the role the list shows.
  async findPaginated(query: UsersListQuery, callerRole: string | null) {
    const { search, sortBy, sortDir } = query;
    const conditions = [
      search
        ? or(ilike(user.name, containsPattern(search)), ilike(user.email, containsPattern(search)))
        : undefined,
      callerRole === ROLES.SUPERADMIN ? undefined : ne(member.role, ROLES.SUPERADMIN),
    ].filter((c): c is SQL => c !== undefined);
    const where = conditions.length ? and(...conditions) : undefined;
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(this.selection())
      .from(user)
      .innerJoin(member, this.membershipJoin())
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db
      .select({ value: count() })
      .from(user)
      .innerJoin(member, this.membershipJoin())
      .where(where);
    return row?.value ?? 0;
  }

  // Deliberately global: creating a user must know whether the email already has an account
  // (in any tenant) to attach it instead of signing up a duplicate.
  findAccountByEmail(email: string) {
    return this.db
      .select({ id: user.id, isPlatformAdmin: user.isPlatformAdmin })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
      .then((r) => r[0]);
  }

  findById(id: string) {
    return this.db
      .select({
        id: user.id,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        isPlatformAdmin: user.isPlatformAdmin,
      })
      .from(user)
      .innerJoin(member, this.membershipJoin())
      .where(eq(user.id, id))
      .limit(1)
      .then((r) => r[0]);
  }

  findPublicById(id: string) {
    return this.db
      .select(this.selection())
      .from(user)
      .innerJoin(member, this.membershipJoin())
      .where(eq(user.id, id))
      .limit(1)
      .then((r) => r[0]);
  }

  // Counts memberships in every organization: a user shared with other tenants must not be
  // modified from here, since `user` (role, name, credentials) is global.
  async countMemberships(userId: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(member)
      .where(eq(member.userId, userId));
    return row?.value ?? 0;
  }

  addMembership(userId: string, role: string) {
    return this.db.insert(member).values({
      id: randomUUID(),
      userId,
      role,
      createdAt: new Date(),
      organizationId: this.tenantId,
    });
  }

  updateUser(id: string, data: UserUpdate) {
    return this.db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(user.id, id), inArray(user.id, this.tenantMemberIds())))
      .returning({ id: user.id })
      .then((r) => r[0]);
  }

  updateMemberRole(userId: string, role: string) {
    return this.db
      .update(member)
      .set({ role })
      .where(and(eq(member.userId, userId), eq(member.organizationId, this.tenantId)))
      .returning({ id: member.id })
      .then((r) => r[0]);
  }

  removeMembership(userId: string) {
    return this.db
      .delete(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, this.tenantId)))
      .returning({ id: member.id })
      .then((r) => r[0]);
  }

  // Sessions are global rows; only the ones working inside this tenant end with the membership.
  deleteTenantSessions(userId: string) {
    return this.db
      .delete(session)
      .where(and(eq(session.userId, userId), eq(session.activeOrganizationId, this.tenantId)));
  }

  // session/account rows cascade on delete (FK onDelete: cascade). The NOT EXISTS clauses keep an
  // account that still belongs to any organization, and one referenced by platform audit rows
  // (their FK restricts deletes so the audit never loses who acted).
  deleteAccountWithoutMemberships(userId: string) {
    return this.db
      .delete(user)
      .where(
        and(
          eq(user.id, userId),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(member)
              .where(eq(member.userId, user.id)),
          ),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(platformAccessLog)
              .where(eq(platformAccessLog.userId, user.id)),
          ),
        ),
      )
      .returning({ id: user.id })
      .then((r) => r[0]);
  }

  // A transaction-scoped advisory lock serializes every create/update/remove of the same email:
  // two concurrent creates would otherwise race on the membership (one failing on the unique
  // (organization_id, user_id) index), and two first-time creates of one email in different
  // tenants could both try to sign it up. Keyed by email only,
  // not by tenant, to cover that second case. A hash collision only serializes unrelated emails.
  withUserLock<T>(email: string, fn: (repo: UsersRepository) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await lockUserEmail(tx, email);
      return fn(new UsersRepository(tx, this.tenantId));
    });
  }

  // Password setup/reset tokens ride on Better Auth's own `verification` table
  // (same `reset-password:<token>` identifier its native `/reset-password` endpoint
  // consumes) so the consuming side needs no custom code.
  deletePendingPasswordSetupTokens(userId: string) {
    return this.db
      .delete(verification)
      .where(
        and(eq(verification.value, userId), like(verification.identifier, 'reset-password:%')),
      );
  }

  createPasswordSetupToken(userId: string, token: string, expiresAt: Date) {
    return this.db.insert(verification).values({
      id: randomUUID(),
      identifier: `reset-password:${token}`,
      value: userId,
      expiresAt,
    });
  }
}
