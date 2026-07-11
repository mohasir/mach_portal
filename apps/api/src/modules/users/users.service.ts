import { TRPCError } from '@trpc/server';
import { paginationMeta, type CreateUserInput, type UpdateUserInput, type UsersListQuery } from '@repo/schemas';
import { auth } from '../../lib/auth';
import { AppError, ErrorCodes } from '../../lib/errors';
import { UsersRepository } from './users.repository';
import { userCollectionResource, userResource } from './users.resource';

export class UsersService {
  constructor(private repo: UsersRepository) {}

  async list(query: UsersListQuery) {
    const { items, total } = await this.repo.findPaginated(query);
    return {
      items: userCollectionResource(items),
      pagination: paginationMeta(total, query.page, query.pageSize),
    };
  }

  async create(input: CreateUserInput) {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) throw new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.user.ALREADY_EXISTS) });

    // Better Auth hashes the password and creates the linked `account` row; a raw
    // insert would not be able to sign in. Role is set right after.
    const { user } = await auth.api.signUpEmail({
      body: { name: input.name, email: input.email, password: input.password },
    });
    const created = await this.repo.updateById(user.id, { role: input.role });
    if (!created) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.user.NOT_FOUND) });
    return userResource(created);
  }

  async update(id: string, input: UpdateUserInput) {
    const updated = await this.repo.updateById(id, { name: input.name, role: input.role });
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.user.NOT_FOUND) });
    return userResource(updated);
  }

  async remove(id: string) {
    // session/account rows cascade on delete (FK onDelete: cascade).
    const deleted = await this.repo.deleteById(id);
    if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.user.NOT_FOUND) });
    return deleted;
  }
}
