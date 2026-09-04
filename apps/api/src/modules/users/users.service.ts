import { randomBytes } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type CreateUserInput,
  type UpdateUserInput,
  type UsersListQuery,
} from '@repo/schemas';
import { auth } from '../../lib/auth';
import { env } from '../../env';
import { AppError, ErrorCodes } from '../../lib/errors';
import { UsersRepository } from './users.repository';
import { userCollectionResource, userResource } from './users.resource';

const PASSWORD_SETUP_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export class UsersService {
  constructor(private repo: UsersRepository) {}

  // Superadmin never learns any user's real password (creation or reset): this issues
  // a single-use link the user opens to set their own password. Reusing Better Auth's
  // own `/reset-password` endpoint on the consuming side means no email is ever sent —
  // the link is handed back to the caller to relay manually (WhatsApp, etc).
  private async issuePasswordSetupLink(userId: string, reason: 'create' | 'reset') {
    await this.repo.deletePendingPasswordSetupTokens(userId);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_SETUP_TOKEN_TTL_MS);
    await this.repo.createPasswordSetupToken(userId, token, expiresAt);
    return `${env.WEB_APP_URL}/set-password?token=${token}&reason=${reason}`;
  }

  async list(query: UsersListQuery, callerRole: string | null) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(
      query,
      callerRole,
    );
    const resource = userCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async create(input: CreateUserInput) {
    const existing = await this.repo.findByEmail(input.email);
    if (existing)
      throw new TRPCError({
        code: 'CONFLICT',
        cause: new AppError(ErrorCodes.user.ALREADY_EXISTS),
      });

    // Better Auth hashes the password and creates the linked `account` row; a raw
    // insert would not be able to sign in. The password itself is thrown away right
    // after — the user sets their real one via the password setup link below, so the
    // superadmin creating the account never learns any usable credential.
    const { user } = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: randomBytes(32).toString('hex') },
    });
    const created = await this.repo.updateById(user.id, {
      role: input.role,
      mustChangePassword: true,
    });
    if (!created)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.user.NOT_FOUND) });
    const setupUrl = await this.issuePasswordSetupLink(user.id, 'create');
    return { user: userResource(created), setupUrl };
  }

  async regeneratePasswordSetupLink(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.user.NOT_FOUND) });
    const reason = existing.mustChangePassword ? ('create' as const) : ('reset' as const);
    const setupUrl = await this.issuePasswordSetupLink(id, reason);
    return { setupUrl, reason };
  }

  async update(id: string, input: UpdateUserInput) {
    const updated = await this.repo.updateById(id, { name: input.name, role: input.role });
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.user.NOT_FOUND) });
    return userResource(updated);
  }

  async remove(id: string) {
    // session/account rows cascade on delete (FK onDelete: cascade).
    const deleted = await this.repo.deleteById(id);
    if (!deleted)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.user.NOT_FOUND) });
    return deleted;
  }
}
