import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type CreateRescheduleReasonInput,
  type RescheduleReasonsListQuery,
  type UpdateRescheduleReasonInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { RescheduleReasonsRepository } from './rescheduleReasons.repository';
import {
  rescheduleReasonCollectionResource,
  rescheduleReasonResource,
} from './rescheduleReasons.resource';

function notFound() {
  return new TRPCError({
    code: 'NOT_FOUND',
    cause: new AppError(ErrorCodes.rescheduleReason.NOT_FOUND),
  });
}

function nameTaken() {
  return new TRPCError({
    code: 'CONFLICT',
    cause: new AppError(ErrorCodes.rescheduleReason.NAME_TAKEN),
  });
}

export class RescheduleReasonsService {
  constructor(private repo: RescheduleReasonsRepository) {}

  async list(query: RescheduleReasonsListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = rescheduleReasonCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async create(input: CreateRescheduleReasonInput) {
    if (await this.repo.findByName(input.name)) throw nameTaken();
    const sortOrder = (await this.repo.getMaxSortOrder()) + 1;
    return rescheduleReasonResource(await this.repo.create({ ...input, sortOrder }));
  }

  async update(id: string, input: UpdateRescheduleReasonInput) {
    if (await this.repo.findByName(input.name, id)) throw nameTaken();
    const updated = await this.repo.updateById(id, input);
    if (!updated) throw notFound();
    return rescheduleReasonResource(updated);
  }

  async toggleActive(id: string, isActive: boolean) {
    const updated = await this.repo.setActive(id, isActive);
    if (!updated) throw notFound();
    return rescheduleReasonResource(updated);
  }
}
