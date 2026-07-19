import { randomUUID } from 'node:crypto';
import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type AssignStaffInput,
  type EventsCalendarQuery,
  type EventsListQuery,
  type RegisterEventPaymentInput,
  type RemoveEventPaymentAttachmentInput,
  type RemoveStaffInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { getStorageProvider, type StorageProvider } from '../../lib/storage';
import { EventsRepository } from './events.repository';
import {
  eventCalendarItemResource,
  eventCollectionResource,
  eventPaymentAttachmentResource,
  eventResource,
  buildEventDetail,
} from './events.resource';

function notFound() {
  return new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.event.NOT_FOUND) });
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

// Structural subset of Express.Multer.File — avoids leaking the multer/Express
// ambient namespace into this file's type surface (walked transitively by any
// consumer of `AppRouter`, which doesn't have `@types/multer` in scope).
export type UploadedPaymentAttachmentFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

export class EventsService {
  constructor(
    private repo: EventsRepository,
    private storage: StorageProvider = getStorageProvider(),
  ) {}

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
    return buildEventDetail(
      result.eventRow,
      result.lineRows,
      result.optionRows,
      result.staffRows,
      result.paymentRows,
      result.attachmentRows,
    );
  }

  async registerPayment(id: string, input: RegisterEventPaymentInput, createdById: string | null) {
    const result = await this.repo.registerPayment(id, input, createdById);
    if (result === undefined) throw notFound();
    if (result === 'exceeds-balance') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.eventPayment.EXCEEDS_BALANCE),
      });
    }
    return { ok: true };
  }

  // Called only from the raw Express upload route (multipart) — throws a bare
  // AppError, not TRPCError, since that transport has no tRPC errorFormatter.
  async addPaymentAttachment(
    paymentId: string,
    file: UploadedPaymentAttachmentFile,
    uploadedById: string | null,
  ) {
    const payment = await this.repo.findPaymentById(paymentId);
    if (!payment) throw new AppError(ErrorCodes.eventPayment.NOT_FOUND, undefined, 404);

    const ext = EXTENSION_BY_MIME[file.mimetype] ?? 'bin';
    const key = `event-payments/${payment.eventId}/${paymentId}/${randomUUID()}.${ext}`;
    const { url } = await this.storage.upload({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const row = await this.repo.createAttachment({
      paymentId,
      key,
      url,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      createdById: uploadedById,
    });
    // The insert's returning row has no join to `user` — the immediate upload response
    // doesn't need the uploader's display name; the frontend refetches via `getById`
    // (which does join it) right after, so this only affects this one response's shape.
    return eventPaymentAttachmentResource({ ...row!, createdByName: null });
  }

  async removePaymentAttachment(input: RemoveEventPaymentAttachmentInput) {
    const deleted = await this.repo.deleteAttachment(input.eventId, input.attachmentId);
    if (!deleted) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        cause: new AppError(ErrorCodes.eventPayment.ATTACHMENT_NOT_FOUND),
      });
    }
    // A leftover R2 object is harmless; a DB row pointing at nothing is worse, so
    // the DB delete above is the source of truth and this failure is only logged.
    await this.storage
      .delete(deleted.key)
      .catch((err) => console.error('storage delete failed', err));
    return { ok: true };
  }

  async markCompleted(id: string) {
    const updated = await this.repo.markCompleted(id);
    if (!updated) throw notFound();
    return eventResource(updated);
  }

  async assignStaff(input: AssignStaffInput) {
    const completed = await this.repo.isCompleted(input.eventId);
    if (completed) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.eventStaff.EVENT_COMPLETED),
      });
    }
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
