import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type CreateEventTypeInput,
  type EventTypesListQuery,
  type UpdateEventTypeInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { EventTypesRepository } from './eventTypes.repository';
import { eventTypeCollectionResource, eventTypeResource } from './eventTypes.resource';

export class EventTypesService {
  constructor(private repo: EventTypesRepository) {}

  async list(query: EventTypesListQuery) {
    const { items, total } = await this.repo.findPaginated(query);
    return {
      items: eventTypeCollectionResource(items),
      pagination: paginationMeta(total, query.page, query.pageSize),
    };
  }

  async create(input: CreateEventTypeInput) {
    const existing = await this.repo.findByName(input.name);
    if (existing) {
      throw new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.eventType.ALREADY_EXISTS) });
    }
    return eventTypeResource(await this.repo.create(input));
  }

  async update(id: string, input: UpdateEventTypeInput) {
    const updated = await this.repo.updateById(id, input);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.eventType.NOT_FOUND) });
    return eventTypeResource(updated);
  }

  async toggleActive(id: string, isActive: boolean) {
    const updated = await this.repo.setActive(id, isActive);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.eventType.NOT_FOUND) });
    return eventTypeResource(updated);
  }
}
