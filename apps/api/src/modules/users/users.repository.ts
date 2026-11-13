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
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { UsersListQuery } from '@repo/schemas';
import type { Executor } from '../../db';
import { lockUserEmail } from '../../db/locks';
import {
  member,
  platformAccessLog,
  role,
  rolePermission,
  session,
  user,
  verification,
} from '../../db/schema';
import { isPgError, PG_FOREIGN_KEY_VIOLATION } from '../../lib/errors';
import { legacyMemberRoleOf } from '../../lib/rbac/seedTenantRoles';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicUserColumns } from './users.resource';
import { containsPattern } from '../../lib/utils/search';

type UserUpdate = Partial<Pick<typeof user.$inferInsert, 'name' | 'mustChangePassword'>>;

const sortColumns = {
  name: user.name,
  email: user.email,
  role: role.name,
  createdAt: user.createdAt,
} as const;

const roleColumns = { id: role.id, name: role.name, isOwner: role.isOwner } as const;

// Users are global; this repository scopes them by MEMBERSHIP: every read joins `member` of this
// tenant, and every write to the global `user` row is limited to members of this tenant.
export class UsersRepository {
  constructor(
    private db: Executor,
    private tenantId: string,
  ) {}

  private membershipJoin() {
    return and(eq(member.userId, user.id), eq(member.organizationId, this.tenantId));
  }

  private roleJoin() {
    return and(eq(role.id, member.roleId), tenantEq(role, this.tenantId));
  }

  private members() {
    return this.db
      .select(this.selection())
      .from(user)
      .innerJoin(member, this.membershipJoin())
      .innerJoin(role, this.roleJoin());
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

  // Members holding the owner role are listed only when `includeOwners` is set (the caller is an
  // owner); everyone else never gets them back, e.g. in the quote reassignment user picker.
  async findPaginated(query: UsersListQuery, includeOwners: boolean) {
    const { search, sortBy, sortDir } = query;
    const conditions = [
      search
        ? or(ilike(user.name, containsPattern(search)), ilike(user.email, containsPattern(search)))
        : undefined,
      includeOwners ? undefined : eq(role.isOwner, false),
    ].filter((c): c is SQL => c !== undefined);
    const where = conditions.length ? and(...conditions) : undefined;
    const direction = sortDir === 'asc' ? asc : desc;
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    // The id tiebreaker keeps pages stable when many members share a sort value (e.g. a role).
    const items = await this.members()
      .where(where)
      .orderBy(direction(sortColumns[sortBy]), asc(user.id))
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
      .innerJoin(role, this.roleJoin())
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
        name: user.name,
        email: user.email,
        mustChangePassword: user.mustChangePassword,
        isPlatformAdmin: user.isPlatformAdmin,
        role: roleColumns,
      })
      .from(user)
      .innerJoin(member, this.membershipJoin())
      .innerJoin(role, this.roleJoin())
      .where(eq(user.id, id))
      .limit(1)
      .then((r) => r[0]);
  }

  findPublicById(id: string) {
    return this.members()
      .where(eq(user.id, id))
      .limit(1)
      .then((r) => r[0]);
  }

  // Share lock until the transaction ends: an edit of the role (which locks it FOR UPDATE) cannot
  // change its permissions between the escalation check and the membership write.
  findRole(roleId: string) {
    return this.db
      .select(roleColumns)
      .from(role)
      .where(and(eq(role.id, roleId), tenantEq(role, this.tenantId)))
      .limit(1)
      .for('share')
      .then((r) => r[0]);
  }

  findRolePermissions(roleId: string) {
    return this.db
      .select({
        resource: rolePermission.resource,
        action: rolePermission.action,
        scope: rolePermission.scope,
      })
      .from(rolePermission)
      .where(and(eq(rolePermission.roleId, roleId), tenantEq(rolePermission, this.tenantId)));
  }

  // Row lock on the tenant's owner role, held until the transaction ends: every change that could
  // leave the tenant without an owner takes it before counting owners, so two such changes
  // serialize and the second one counts what the first one committed.
  lockOwnerRole() {
    return this.db
      .select({ id: role.id })
      .from(role)
      .where(and(tenantEq(role, this.tenantId), eq(role.isOwner, true)))
      .for('update')
      .then((r) => r[0]);
  }

  async countOwners() {
    const [row] = await this.db
      .select({ value: count() })
      .from(member)
      .innerJoin(role, this.roleJoin())
      .where(and(eq(member.organizationId, this.tenantId), eq(role.isOwner, true)));
    return row?.value ?? 0;
  }

  // Counts memberships in every organization: a user shared with other tenants must not be
  // modified from here, since `user` (name, credentials) is global.
  async countMemberships(userId: string) {
    const [row] = await this.db
      .select({ value: count() })
      .from(member)
      .where(eq(member.userId, userId));
    return row?.value ?? 0;
  }

  // Undefined when the role is not one of this tenant's: a foreign role is never attached.
  async addMembership(userId: string, roleId: string) {
    const target = await this.findRole(roleId);
    if (!target) return undefined;
    return this.db
      .insert(member)
      .values({
        id: randomUUID(),
        userId,
        role: legacyMemberRoleOf(target),
        roleId: target.id,
        createdAt: new Date(),
        organizationId: this.tenantId,
      })
      .returning({ id: member.id })
      .then((r) => r[0]);
  }

  updateUser(id: string, data: UserUpdate) {
    return this.db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(user.id, id), inArray(user.id, this.tenantMemberIds())))
      .returning({ id: user.id })
      .then((r) => r[0]);
  }

  // Undefined when the user is not a member here or the role is not one of this tenant's.
  async updateMemberRole(userId: string, roleId: string) {
    const target = await this.findRole(roleId);
    if (!target) return undefined;
    return this.db
      .update(member)
      .set({ roleId: target.id, role: legacyMemberRoleOf(target) })
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
  // (their FK restricts deletes so the audit never loses who acted). Under RLS the audit check only
  // sees this tenant's rows, so audit rows of another tenant surface as an FK violation instead:
  // the savepoint confines that failure, which then means the same "account kept".
  async deleteAccountWithoutMemberships(userId: string) {
    try {
      return await this.db.transaction((tx) => this.deleteUnreferencedAccount(tx, userId));
    } catch (error) {
      if (isPgError(error, PG_FOREIGN_KEY_VIOLATION)) return undefined;
      throw error;
    }
  }

  private deleteUnreferencedAccount(tx: Executor, userId: string) {
    return tx
      .delete(user)
      .where(
        and(
          eq(user.id, userId),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(member)
              .where(eq(member.userId, user.id)),
          ),
          notExists(
            tx
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
