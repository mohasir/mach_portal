import { randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type CreateUserInput,
  type UpdateUserInput,
  type UsersListQuery,
} from '@repo/schemas';
import type { AccessGrants } from '@repo/guards';
import { auth } from '../../lib/auth';
import { env } from '../../env';
import { AppError, ErrorCodes } from '../../lib/errors';
import { assertWithinPower, canAssignRole } from '../roles/roles.service';
import { UsersRepository } from './users.repository';
import { userCollectionResource, userResource, type MembershipRole } from './users.resource';

const PASSWORD_SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type UsersActor = { isPlatformAdmin: boolean; access: AccessGrants };

type TargetUser = NonNullable<Awaited<ReturnType<UsersRepository['findById']>>>;

type CreateUserResult = { user: ReturnType<typeof userResource>; setupUrl: string | null };

const notFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.user.NOT_FOUND) });

const alreadyExists = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.user.ALREADY_EXISTS) });

const roleNotFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.role.NOT_FOUND) });

const escalation = () =>
  new TRPCError({ code: 'FORBIDDEN', cause: new AppError(ErrorCodes.role.PRIVILEGE_ESCALATION) });

const lastOwner = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.role.LAST_OWNER) });

const setupUrl = (token: string, reason: 'create' | 'reset') =>
  `${env.WEB_APP_URL}/set-password?token=${token}&reason=${reason}`;

export class UsersService {
  constructor(
    private repo: UsersRepository,
    private actor: UsersActor,
  ) {}

  // The person issuing the link never learns any user's real password (creation or reset): this
  // issues a single-use link the user opens to set their own password. Reusing Better Auth's
  // own `/reset-password` endpoint on the consuming side means no email is ever sent —
  // the link is handed back to the caller to relay manually (WhatsApp, etc).
  private async writePasswordSetupToken(repo: UsersRepository, userId: string) {
    await repo.deletePendingPasswordSetupTokens(userId);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_SETUP_TOKEN_TTL_MS);
    await repo.createPasswordSetupToken(userId, token, expiresAt);
    return token;
  }

  // `user` (name, credentials) is global, so a tenant admin must not change an account that other
  // tenants (or the platform) also rely on. Roles live on the membership and are not covered here.
  private async assertManageable(repo: UsersRepository, target: TargetUser) {
    if (this.actor.isPlatformAdmin) return;
    if (target.isPlatformAdmin)
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: new AppError(ErrorCodes.user.IS_PLATFORM_ADMIN),
      });
    if ((await repo.countMemberships(target.id)) > 1)
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: new AppError(ErrorCodes.user.IN_MULTIPLE_ORGANIZATIONS),
      });
  }

  // Resolves the id inside the tenant first (foreign and nonexistent ids are both NOT_FOUND),
  // then re-reads it under the email lock so membership checks and writes see a stable state.
  private async withTarget<T>(
    id: string,
    fn: (repo: UsersRepository, target: TargetUser) => Promise<T>,
  ) {
    const target = await this.repo.findById(id);
    if (!target) throw notFound();
    return this.repo.withUserLock(target.email, async (repo) => {
      const locked = await repo.findById(id);
      if (!locked) throw notFound();
      return fn(repo, locked);
    });
  }

  // Foreign and nonexistent ids look alike.
  private async resolveAssignableRole(repo: UsersRepository, roleId: string) {
    const target = await repo.findRole(roleId);
    if (!target) throw roleNotFound();
    const { access } = this.actor;
    const permissions =
      access.isOwner || target.isOwner ? [] : await repo.findRolePermissions(target.id);
    if (!canAssignRole(access, target, permissions)) throw escalation();
    return target;
  }

  // A non-owner cannot act on a member whose current role is the owner role or is stronger than
  // their own: changing, renaming, removing or resetting that member would be using power they do
  // not hold. Owner members are hidden from non-owners in the list, so they answer as nonexistent.
  private async assertCanActOnMember(repo: UsersRepository, current: MembershipRole) {
    if (this.actor.access.isOwner) return;
    if (current.isOwner) throw notFound();
    assertWithinPower(this.actor.access, await repo.findRolePermissions(current.id));
  }

  // Must run inside the transaction that writes the change, after lockOwnerRole.
  private async assertNotLastOwner(repo: UsersRepository, current: MembershipRole) {
    if (current.isOwner && (await repo.countOwners()) <= 1) throw lastOwner();
  }

  async list(query: UsersListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(
      query,
      this.actor.access.isOwner,
    );
    const resource = userCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  // Never holds a transaction (and so a pool connection) while Better Auth's sign-up waits for a
  // connection of its own: enough concurrent creates would otherwise fill the pool with waiting
  // transactions and block every request. The email lock is taken before and after sign-up
  // instead, and a sign-up that loses a race for the same email falls back to the existing
  // account path.
  async create(input: CreateUserInput): Promise<CreateUserResult> {
    const email = input.email.toLowerCase();
    // Checked before any account exists, so a refused role never leaves a sign-up behind.
    await this.resolveAssignableRole(this.repo, input.roleId);
    const attached = await this.attachExistingAccount(email, input.roleId);
    if (attached) return attached;

    // Better Auth hashes the password and creates the linked `account` row; a raw
    // insert would not be able to sign in. The password itself is thrown away right
    // after — the user sets their real one via the password setup link below, so the
    // person creating the account never learns any usable credential.
    let userId: string;
    try {
      const { user } = await auth.api.signUpEmail({
        body: { name: input.name, email, password: randomBytes(32).toString('hex') },
      });
      userId = user.id;
    } catch (error) {
      const retried = await this.attachExistingAccount(email, input.roleId);
      if (retried) return retried;
      throw error;
    }

    try {
      const { created, token } = await this.repo.withUserLock(email, async (repo) => {
        // Any membership, in any tenant, means another create attached this account between sign-up
        // and now; writing a setup link here would reach into that tenant.
        if ((await repo.countMemberships(userId)) > 0) throw alreadyExists();
        // Re-checked under the role's share lock: the role may have been edited since the pre-check.
        const role = await this.resolveAssignableRole(repo, input.roleId);
        if (!(await repo.addMembership(userId, role.id))) throw roleNotFound();
        await repo.updateUser(userId, { mustChangePassword: true });
        const created = await repo.findPublicById(userId);
        if (!created) throw notFound();
        return { created, token: await this.writePasswordSetupToken(repo, userId) };
      });
      return { user: userResource(created), setupUrl: setupUrl(token, 'create') };
    } catch (error) {
      // Leaves no account behind without membership, so retrying the create starts over. An
      // account that meanwhile got a membership elsewhere is kept by the repository guard.
      await this.repo
        .withUserLock(email, (repo) => repo.deleteAccountWithoutMemberships(userId))
        .catch((cleanupErr) => console.error('user create cleanup failed', cleanupErr));
      throw error;
    }
  }

  // Attaching an account that already exists is reserved to platform admins: a tenant admin could
  // otherwise pre-register someone's email, keep its credential and later follow that person into
  // any tenant that adds them. Tenant admins get the same answer as for a current member. The
  // attached account keeps its password, `mustChangePassword` and name, and no link is issued.
  private attachExistingAccount(
    email: string,
    roleId: string,
  ): Promise<CreateUserResult | undefined> {
    return this.repo.withUserLock(email, async (repo) => {
      const existing = await repo.findAccountByEmail(email);
      if (!existing) return undefined;
      if (!this.actor.isPlatformAdmin || (await repo.findById(existing.id))) throw alreadyExists();
      const role = await this.resolveAssignableRole(repo, roleId);
      if (!(await repo.addMembership(existing.id, role.id))) throw roleNotFound();
      const added = await repo.findPublicById(existing.id);
      if (!added) throw notFound();
      return { user: userResource(added), setupUrl: null };
    });
  }

  async regeneratePasswordSetupLink(id: string) {
    const { token, reason } = await this.withTarget(id, async (repo, target) => {
      await this.assertCanActOnMember(repo, target.role);
      await this.assertManageable(repo, target);
      const reason = target.mustChangePassword ? ('create' as const) : ('reset' as const);
      return { token: await this.writePasswordSetupToken(repo, id), reason };
    });
    return { setupUrl: setupUrl(token, reason), reason };
  }

  // The name is global (guarded by assertManageable); the role only touches this membership.
  async update(id: string, input: UpdateUserInput) {
    return this.withTarget(id, async (repo, target) => {
      await this.assertCanActOnMember(repo, target.role);
      const renaming = input.name !== target.name;
      if (renaming) await this.assertManageable(repo, target);
      if (input.roleId !== target.role.id) {
        await repo.lockOwnerRole();
        const current = (await repo.findById(id))?.role;
        if (!current) throw notFound();
        await this.assertCanActOnMember(repo, current);
        const next = await this.resolveAssignableRole(repo, input.roleId);
        if (!next.isOwner) await this.assertNotLastOwner(repo, current);
        if (!(await repo.updateMemberRole(id, next.id))) throw notFound();
      }
      if (renaming) await repo.updateUser(id, { name: input.name });
      const updated = await repo.findPublicById(id);
      if (!updated) throw notFound();
      return userResource(updated);
    });
  }

  // Removing a user from a tenant ends the membership and the sessions working in this tenant;
  // the account itself goes away only when no organization is left, and a platform admin
  // account is never deleted from inside a tenant.
  async remove(id: string) {
    return this.withTarget(id, async (repo, target) => {
      await repo.lockOwnerRole();
      const current = (await repo.findById(id))?.role;
      if (!current) throw notFound();
      await this.assertCanActOnMember(repo, current);
      await this.assertNotLastOwner(repo, current);
      const removed = await repo.removeMembership(id);
      if (!removed) throw notFound();
      await repo.deleteTenantSessions(id);
      if (!target.isPlatformAdmin) await repo.deleteAccountWithoutMemberships(id);
      return { id };
    });
  }
}
