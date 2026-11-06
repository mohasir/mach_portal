import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type CreateStaffInput,
  type StaffListQuery,
  type UpdateStaffInput,
} from '@repo/schemas';
import { AppError, ErrorCodes, isPgError, PG_FOREIGN_KEY_VIOLATION } from '../../lib/errors';
import { StaffRepository } from './staff.repository';
import { staffCollectionResource, staffResource } from './staff.resource';

export class StaffService {
  constructor(private repo: StaffRepository) {}

  async list(query: StaffListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = staffCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async getAvailability(date: string) {
    const rows = await this.repo.findAvailable(date);
    return staffCollectionResource(rows);
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
    const deleted = await this.repo.deleteById(id).catch((error: unknown) => {
      if (isPgError(error, PG_FOREIGN_KEY_VIOLATION)) {
        throw new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.staff.IN_USE) });
      }
      throw error;
    });
    if (!deleted)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.staff.NOT_FOUND) });
    return deleted;
  }
}
