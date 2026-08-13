import { TRPCError } from '@trpc/server';
import {
  canTransition,
  computeQuoteTotals,
  paginationMeta,
  QUOTE_STAGE,
  TEMPLATE_TYPES,
  type CreateQuoteInput,
  type QuoteLineInput,
  type QuoteStageId,
  type QuotesBoardQuery,
  type QuotesListQuery,
  type UpdateQuoteInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { generateQuotePdf } from '../../lib/pdfService/client';
import { ConfigRepository } from '../config/config.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import type { NotificationActor } from '../notifications/notifications.resource';
import { ProductsRepository } from '../products/products.repository';
import { buildProductTree } from '../products/products.resource';
import { TemplatesRepository } from '../templates/templates.repository';
import { quotePdfTemplateResource } from '../templates/templates.resource';
import { QuotesRepository } from './quotes.repository';
import { buildQuotePdfPayload } from './quotes.pdf';
import { validateLineSelections, type CatalogContext } from './quotes.validation';
import {
  buildQuoteDetail,
  buildQuoteLineDetails,
  isQuoteComplete,
  quoteCardResource,
  quoteListItemResource,
  quoteResource,
  type PublicQuote,
} from './quotes.resource';

const EDITABLE_STAGES: QuoteStageId[] = [QUOTE_STAGE.PENDING, QUOTE_STAGE.QUOTED];
const PDF_ALLOWED_STAGES: QuoteStageId[] = [QUOTE_STAGE.QUOTED, QUOTE_STAGE.CONFIRMED];

function notFound() {
  return new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.quote.NOT_FOUND) });
}
function invalidLines() {
  return new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.quote.INVALID_LINES),
  });
}

export class QuotesService {
  constructor(
    private repo: QuotesRepository,
    private configRepo: ConfigRepository,
    private productsRepo: ProductsRepository,
    private templatesRepo: TemplatesRepository,
    private notificationsRepo: NotificationsRepository,
  ) {}

  async list(query: QuotesListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = items.map(quoteListItemResource);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async getById(id: string) {
    const result = await this.repo.findById(id);
    if (!result) throw notFound();
    return buildQuoteDetail(
      result.quoteRow,
      result.lineRows,
      result.optionRows,
      result.historyRows,
    );
  }

  async generatePdf(id: string) {
    const result = await this.repo.findById(id);
    if (!result) throw notFound();
    if (!PDF_ALLOWED_STAGES.includes(result.quoteRow.stageId as QuoteStageId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.quote.PDF_NOT_ALLOWED),
      });
    }

    const lines = buildQuoteLineDetails(result.lineRows, result.optionRows);
    const { productRows, tierRows, groupRows, optionRows } = await this.productsRepo.findTree(true);
    const catalog = buildProductTree(productRows, tierRows, groupRows, optionRows);
    const templateRow = await this.templatesRepo.findByType(TEMPLATE_TYPES.QUOTE_PDF);
    const { content: template } = quotePdfTemplateResource(templateRow);

    const payload = buildQuotePdfPayload(result.quoteRow, lines, catalog, template);

    let pdf: { url: string; key: string };
    try {
      pdf = await generateQuotePdf(payload);
    } catch (err) {
      console.error('pdf generation failed', err);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        cause: new AppError(ErrorCodes.quote.PDF_GENERATION_FAILED),
      });
    }

    const updated = await this.repo.setPdfInfo(id, pdf);
    if (!updated) throw notFound();
    return quoteResource(updated);
  }

  async board(query: QuotesBoardQuery) {
    const rows = await this.repo.findBoard(query);
    const grouped: Record<QuoteStageId, ReturnType<typeof quoteCardResource>[]> = {
      [QUOTE_STAGE.PENDING]: [],
      [QUOTE_STAGE.QUOTED]: [],
      [QUOTE_STAGE.CONFIRMED]: [],
      [QUOTE_STAGE.CANCELLED]: [],
    };
    for (const row of rows) grouped[row.stageId as QuoteStageId].push(quoteCardResource(row));
    return grouped;
  }

  async create(input: CreateQuoteInput, userId: string) {
    await this.validateLines(input.lines);

    const [stateRows, appRow, maxSeq] = await Promise.all([
      this.configRepo.findStateSettings(),
      this.configRepo.findAppSettings(),
      this.repo.getMaxSeq(),
    ]);
    if (!appRow)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.config.NOT_FOUND) });

    const now = new Date();
    const taxRate = appRow.applyTaxByState
      ? (stateRows.find((s) => s.state === input.state)?.taxRate ?? 0)
      : 0;
    const depositRate = input.depositRate ?? appRow.depositRate;
    const totals = computeQuoteTotals({
      lines: input.lines.map((l) => ({ subtotal: l.subtotal })),
      discountType: input.discountType,
      discountValue: input.discountValue,
      longDistanceAmount: input.longDistanceAmount,
      taxRate,
      depositRate,
    });

    const seq = Math.max(maxSeq, appRow.quoteSeqStart - 1) + 1;
    const number = buildQuoteNumber(now, seq);
    const validUntil = addMonths(now, appRow.quoteValidityMonths);

    const created = await this.repo.insertFull(
      {
        seq,
        number,
        clientId: input.clientId,
        eventTypeId: input.eventTypeId ?? null,
        eventDate: input.eventDate ?? null,
        eventTime: input.eventTime ?? null,
        state: input.state ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        notes: input.notes ?? null,
        discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null,
        isDraft: input.isDraft,
        selectOptionsAtQuote: input.selectOptionsAtQuote,
        validUntil,
        createdById: userId,
        ...totals,
      },
      input.lines,
      input.newClient,
    );
    return quoteResource(created);
  }

  async update(id: string, input: UpdateQuoteInput) {
    const current = await this.repo.findQuoteRow(id);
    if (!current) throw notFound();
    if (!EDITABLE_STAGES.includes(current.stageId as QuoteStageId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.quote.NOT_EDITABLE),
      });
    }
    await this.validateLines(input.lines);

    const totals = await this.resolveTotals(current, input);

    const updated = await this.repo.replaceLines(
      id,
      {
        clientId: input.clientId,
        eventTypeId: input.eventTypeId ?? null,
        eventDate: input.eventDate ?? null,
        eventTime: input.eventTime ?? null,
        state: input.state ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        notes: input.notes ?? null,
        discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null,
        isDraft: input.isDraft,
        selectOptionsAtQuote: input.selectOptionsAtQuote,
        ...totals,
      },
      input.lines,
      input.newClient,
    );
    if (!updated) throw notFound();
    return quoteResource(updated);
  }

  // stage 'new' re-snapshots rates from live config (the draft isn't final yet); from
  // 'quoted' onward the rates stay frozen and only the derived amounts move
  // (mach-bar-domain.md §7, "queda fija").
  private async resolveTotals(current: PublicQuote, input: UpdateQuoteInput) {
    const lines = { lines: input.lines.map((l) => ({ subtotal: l.subtotal })) };
    if (current.stageId === QUOTE_STAGE.QUOTED) {
      return computeQuoteTotals({
        ...lines,
        discountType: input.discountType,
        discountValue: input.discountValue,
        longDistanceAmount: input.longDistanceAmount,
        taxRate: current.taxRate,
        depositRate: current.depositRate,
      });
    }

    const [stateRows, appRow] = await Promise.all([
      this.configRepo.findStateSettings(),
      this.configRepo.findAppSettings(),
    ]);
    if (!appRow)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.config.NOT_FOUND) });

    const taxRate = appRow.applyTaxByState
      ? (stateRows.find((s) => s.state === input.state)?.taxRate ?? 0)
      : 0;
    const depositRate = input.depositRate ?? appRow.depositRate;
    return computeQuoteTotals({
      ...lines,
      discountType: input.discountType,
      discountValue: input.discountValue,
      longDistanceAmount: input.longDistanceAmount,
      taxRate,
      depositRate,
    });
  }

  async updateStage(id: string, stageId: QuoteStageId, userId: string) {
    const current = await this.repo.findQuoteRow(id);
    if (!current) throw notFound();
    const fromStageId = current.stageId as QuoteStageId;
    this.assertTransition(fromStageId, stageId);
    if (stageId === QUOTE_STAGE.QUOTED) await this.assertReadyToSend(current, id);

    const updated = await this.repo.updateStage(id, fromStageId, stageId, userId);
    if (!updated) throw notFound();
    return quoteResource(updated);
  }

  async approve(id: string, userId: string, actor: NotificationActor) {
    const current = await this.repo.findQuoteRow(id);
    if (!current) throw notFound();
    const fromStageId = current.stageId as QuoteStageId;
    this.assertTransition(fromStageId, QUOTE_STAGE.CONFIRMED);

    // Flow B (options already chosen at quote time) means the event is born resolved; Flow A
    // (default) leaves it pending until someone completes it from the event screen (§events.updateSelections).
    const updated = await this.repo.approveWithEvent(id, fromStageId, userId, {
      clientId: current.clientId,
      eventTypeId: current.eventTypeId,
      eventDate: current.eventDate,
      eventTime: current.eventTime,
      state: current.state,
      address: current.address,
      city: current.city,
      totalAmount: current.total,
      selectionsConfirmedAt: current.selectOptionsAtQuote ? new Date() : null,
      selectionsConfirmedById: current.selectOptionsAtQuote ? userId : null,
    });
    if (!updated) throw notFound();
    await this.notificationsRepo.create({
      type: 'quote_confirmed',
      data: { quoteNumber: updated.number, source: 'user', actor },
      entityType: 'quote',
      entityId: id,
      excludedUserId: userId,
    });
    return quoteResource(updated);
  }

  async cancel(id: string, userId: string, actor: NotificationActor) {
    const current = await this.repo.findQuoteRow(id);
    if (!current) throw notFound();
    const fromStageId = current.stageId as QuoteStageId;
    this.assertTransition(fromStageId, QUOTE_STAGE.CANCELLED);
    const updated = await this.repo.updateStage(id, fromStageId, QUOTE_STAGE.CANCELLED, userId);
    if (!updated) throw notFound();
    await this.notificationsRepo.create({
      type: 'quote_cancelled',
      data: { quoteNumber: updated.number, source: 'user', actor },
      entityType: 'quote',
      entityId: id,
      excludedUserId: userId,
    });
    return quoteResource(updated);
  }

  async archive(id: string) {
    const archived = await this.repo.archiveById(id);
    if (!archived) throw notFound();
    return archived;
  }

  private assertTransition(from: QuoteStageId, to: QuoteStageId) {
    if (!canTransition(from, to)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.quote.INVALID_TRANSITION),
      });
    }
  }

  private async assertReadyToSend(current: PublicQuote, id: string) {
    const linesCount = await this.repo.countLines(id);
    if (!isQuoteComplete(current, linesCount)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.quote.INCOMPLETE),
      });
    }
  }

  // Revalidates every line against the live catalog (mach-bar-domain.md D16/D17) — the
  // builder UI already prevents this, this is the server-side boundary.
  private async validateLines(lines: QuoteLineInput[]) {
    if (lines.length === 0) return;
    const ctx = await this.repo.loadCatalogContext(lines.map((l) => l.productId));
    for (const line of lines) this.validateLine(line, ctx);
  }

  private validateLine(line: QuoteLineInput, ctx: CatalogContext) {
    const product = ctx.products.find((p) => p.id === line.productId);
    if (!product?.isActive) throw invalidLines();

    // numPersons doesn't have to match a catalog tier — the builder also allows a custom
    // quantity/price override per line; numPersons/subtotal bounds are enforced by the schema.

    if (!validateLineSelections(line.productId, line.selections, ctx)) throw invalidLines();
  }
}

function buildQuoteNumber(date: Date, seq: number): string {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `QUO${yyyymmdd}-${String(seq).padStart(6, '0')}`;
}

function addMonths(date: Date, months: number): string {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result.toISOString().slice(0, 10);
}
