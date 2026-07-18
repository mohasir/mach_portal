import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type AssignStaffInput,
  type EventsCalendarQuery,
  type EventsListQuery,
  type RemoveStaffInput,
  type UpdateEventPaymentInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { EventsRepository } from './events.repository';
import {
  eventCalendarItemResource,
  eventCollectionResource,
  eventResource,
  buildEventDetail,
} from './events.resource';

function notFound() {
  return new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.event.NOT_FOUND) });
}

export class EventsService {
  constructor(private repo: EventsRepository) {}

  async list(query: EventsListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = eventCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async calendar(query: EventsCalendarQuery) {
    const rows = await this.repo.findCalendarRange(query);
    return rows.map(eventCalendarItemResource);
  }

  async getById(id: string) {
    const result = await this.repo.findById(id);
    if (!result) throw notFound();
    return buildEventDetail(result.eventRow, result.lineRows, result.optionRows, result.staffRows);
  }

  async updatePayment(id: string, input: UpdateEventPaymentInput) {
    const updated = await this.repo.updatePayment(id, input);
    if (!updated) throw notFound();
    return eventResource(updated);
  }

  async markCompleted(id: string) {
    const updated = await this.repo.markCompleted(id);
    if (!updated) throw notFound();
    return eventResource(updated);
  }

  async assignStaff(input: AssignStaffInput) {
    const alreadyAssigned = await this.repo.isStaffAssigned(input.eventId, input.staffId);
    if (alreadyAssigned) {
      throw new TRPCError({
        code: 'CONFLICT',
        cause: new AppError(ErrorCodes.eventStaff.ALREADY_ASSIGNED),
      });
    }
    return this.repo.assignStaff(input);
  }

  async removeStaff(input: RemoveStaffInput) {
    const removed = await this.repo.removeStaff(input);
    if (!removed) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        cause: new AppError(ErrorCodes.eventStaff.NOT_FOUND),
      });
    }
    return removed;
  }
}
