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
  type UpdateEventSelectionsInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { getStorageProvider, type StorageProvider } from '../../lib/storage';
import { ConfigRepository } from '../config/config.repository';
import { QuotesRepository } from '../quotes/quotes.repository';
import { validateLineSelections } from '../quotes/quotes.validation';
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
function invalidSelections() {
  return new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.event.INVALID_SELECTIONS),
  });
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
    private quotesRepo: QuotesRepository,
    private configRepo: ConfigRepository,
    private storage: StorageProvider = getStorageProvider(),
  ) {}

  // scope 'own' (resolveResourceScope) → 404 instead of leaking that an event exists
  // for a quote the caller neither created nor is assigned to.
  private async assertOwner(eventId: string, ownerId?: string) {
    if (ownerId && !(await this.repo.belongsToOwner(eventId, ownerId))) throw notFound();
  }

  async list(query: EventsListQuery, ownerId?: string) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(
      query,
      ownerId,
    );
    const resource = eventCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async calendar(query: EventsCalendarQuery, ownerId?: string) {
    const rows = await this.repo.findCalendarRange(query, ownerId);
    return rows.map(eventCalendarItemResource);
  }

  async getById(id: string, ownerId?: string) {
    const [result, appRow] = await Promise.all([
      this.repo.findById(id, ownerId),
      this.configRepo.findAppSettings(),
    ]);
    if (!result) throw notFound();
    return buildEventDetail(
      result.eventRow,
      result.lineRows,
      result.optionRows,
      result.staffRows,
      result.paymentRows,
      result.attachmentRows,
      appRow?.optionsSelectionDeadlineDays ?? 0,
    );
  }

  async updateSelections(
    eventId: string,
    input: UpdateEventSelectionsInput,
    userId: string,
    ownerId?: string,
  ) {
    await this.assertOwner(eventId, ownerId);
    const event = await this.repo.findForSelectionsUpdate(eventId);
    if (!event) throw notFound();
    if (event.completedAt) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.event.COMPLETED),
      });
    }

    const quoteLines = await this.quotesRepo.findLinesByQuoteId(event.quoteId);
    const byLineId = new Map(input.selections.map((s) => [s.quoteLineId, s]));
    const productIdByLineId = new Map(quoteLines.map((l) => [l.id, l.productId]));

    // Every quoteLineId sent must actually belong to this event's quote.
    for (const lineId of byLineId.keys()) {
      if (!productIdByLineId.has(lineId)) throw invalidSelections();
    }

    const ctx = await this.quotesRepo.loadCatalogContext(quoteLines.map((l) => l.productId));
    const grouped = new Map<string, typeof input.selections>();
    for (const selection of input.selections) {
      const arr = grouped.get(selection.quoteLineId) ?? [];
      arr.push(selection);
      grouped.set(selection.quoteLineId, arr);
    }
    for (const [lineId, selections] of grouped) {
      const productId = productIdByLineId.get(lineId)!;
      if (!validateLineSelections(productId, selections, ctx)) throw invalidSelections();
    }

    const updated = await this.repo.updateSelections(eventId, input.selections, userId);
    if (!updated) throw notFound();
    return eventResource(updated);
  }

  async registerPayment(
    id: string,
    input: RegisterEventPaymentInput,
    createdById: string | null,
    ownerId?: string,
  ) {
    await this.assertOwner(id, ownerId);
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
    const key = `event-payments/${randomUUID()}.${ext}`;
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

  async removePaymentAttachment(input: RemoveEventPaymentAttachmentInput, ownerId?: string) {
    await this.assertOwner(input.eventId, ownerId);
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

  async markCompleted(id: string, ownerId?: string) {
    await this.assertOwner(id, ownerId);
    const updated = await this.repo.markCompleted(id);
    if (!updated) throw notFound();
    return eventResource(updated);
  }

  async assignStaff(input: AssignStaffInput, ownerId?: string) {
    await this.assertOwner(input.eventId, ownerId);
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

  async removeStaff(input: RemoveStaffInput, ownerId?: string) {
    await this.assertOwner(input.eventId, ownerId);
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
