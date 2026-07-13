import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type CreateStaffInput,
  type StaffListQuery,
  type UpdateStaffInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { StaffRepository } from './staff.repository';
import { staffCollectionResource, staffResource } from './staff.resource';

export class StaffService {
  constructor(private repo: StaffRepository) {}

  async list(query: StaffListQuery) {
    const { items, total } = await this.repo.findPaginated(query);
    return {
      items: staffCollectionResource(items),
      pagination: paginationMeta(total, query.page, query.pageSize),
    };
  }

  async create(input: CreateStaffInput) {
    const created = await this.repo.create(input);
    return staffResource(created);
  }

  async update(id: string, input: UpdateStaffInput) {
    const updated = await this.repo.updateById(id, input);
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.staff.NOT_FOUND) });
    return staffResource(updated);
  }

  async remove(id: string) {
    const deleted = await this.repo.deleteById(id);
    if (!deleted)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.staff.NOT_FOUND) });
    return deleted;
  }
}
