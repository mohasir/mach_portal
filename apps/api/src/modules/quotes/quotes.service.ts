import { TRPCError } from '@trpc/server';
import {
  canTransition,
  computeQuoteTotals,
  paginationMeta,
  type CreateQuoteInput,
  type QuoteLineInput,
  type QuoteStage,
  type QuotesBoardQuery,
  type QuotesListQuery,
  type UpdateQuoteInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { ConfigRepository } from '../config/config.repository';
import { QuotesRepository } from './quotes.repository';
import {
  buildQuoteDetail,
  quoteCardResource,
  quoteListItemResource,
  quoteResource,
  type PublicQuote,
} from './quotes.resource';

const EDITABLE_STAGES: QuoteStage[] = ['new', 'quoted'];

type CatalogContext = Awaited<ReturnType<QuotesRepository['loadCatalogContext']>>;

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
  ) {}

  async list(query: QuotesListQuery) {
    const { items, total } = await this.repo.findPaginated(query);
    return {
      items: items.map(quoteListItemResource),
      pagination: paginationMeta(total, query.page, query.pageSize),
    };
  }

  async getById(id: string) {
    const result = await this.repo.findById(id);
    if (!result) throw notFound();
    return buildQuoteDetail(result.quoteRow, result.lineRows, result.optionRows);
  }

  async board(query: QuotesBoardQuery) {
    const rows = await this.repo.findBoard(query);
    const grouped: Record<QuoteStage, ReturnType<typeof quoteCardResource>[]> = {
      new: [],
      quoted: [],
      confirmed: [],
      completed: [],
      cancelled: [],
    };
    for (const row of rows) grouped[row.stage].push(quoteCardResource(row));
    return grouped;
  }

  async create(input: CreateQuoteInput) {
    await this.validateLines(input.lines);

    const [stateRows, appRow, maxSeq] = await Promise.all([
      this.configRepo.findStateSettings(),
      this.configRepo.findAppSettings(),
      this.repo.getMaxSeq(),
    ]);
    if (!appRow)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.config.NOT_FOUND) });

    const now = new Date();
    const taxRate = stateRows.find((s) => s.state === input.state)?.taxRate ?? 0;
    const depositRate = input.depositRate ?? appRow.depositRate;
    const totals = computeQuoteTotals({
      lines: input.lines.map((l) => ({ subtotal: l.subtotal })),
      discountType: input.discountType,
      discountValue: input.discountValue,
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
        notes: input.notes ?? null,
        discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null,
        validUntil,
        ...totals,
      },
      input.lines,
    );
    return quoteResource(created);
  }

  async update(id: string, input: UpdateQuoteInput) {
    const current = await this.repo.findQuoteRow(id);
    if (!current) throw notFound();
    if (!EDITABLE_STAGES.includes(current.stage)) {
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
        notes: input.notes ?? null,
        discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null,
        ...totals,
      },
      input.lines,
    );
    if (!updated) throw notFound();
    return quoteResource(updated);
  }

  // stage 'new' re-snapshots rates from live config (the draft isn't final yet); from
  // 'quoted' onward the rates stay frozen and only the derived amounts move
  // (mach-bar-domain.md §7, "queda fija").
  private async resolveTotals(current: PublicQuote, input: UpdateQuoteInput) {
    const lines = { lines: input.lines.map((l) => ({ subtotal: l.subtotal })) };
    if (current.stage === 'quoted') {
      return computeQuoteTotals({
        ...lines,
        discountType: input.discountType,
        discountValue: input.discountValue,
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

    const taxRate = stateRows.find((s) => s.state === input.state)?.taxRate ?? 0;
    const depositRate = input.depositRate ?? appRow.depositRate;
    return computeQuoteTotals({
      ...lines,
      discountType: input.discountType,
      discountValue: input.discountValue,
      taxRate,
      depositRate,
    });
  }

  async updateStage(id: string, stage: QuoteStage) {
    const current = await this.repo.findQuoteRow(id);
    if (!current) throw notFound();
    this.assertTransition(current.stage, stage);
    if (stage === 'quoted') await this.assertReadyToSend(current, id);

    const updated = await this.repo.updateStage(id, stage);
    if (!updated) throw notFound();
    return quoteResource(updated);
  }

  async approve(id: string) {
    const current = await this.repo.findQuoteRow(id);
    if (!current) throw notFound();
    this.assertTransition(current.stage, 'confirmed');
    // Fase 4 scope: only flips the stage. Creating the derived event is Fase 5
    // (mach-bar-domain.md §11 "approve NO crea el evento todavía").
    const updated = await this.repo.updateStage(id, 'confirmed');
    if (!updated) throw notFound();
    return quoteResource(updated);
  }

  async cancel(id: string) {
    const current = await this.repo.findQuoteRow(id);
    if (!current) throw notFound();
    this.assertTransition(current.stage, 'cancelled');
    const updated = await this.repo.updateStage(id, 'cancelled');
    if (!updated) throw notFound();
    return quoteResource(updated);
  }

  private assertTransition(from: QuoteStage, to: QuoteStage) {
    if (!canTransition(from, to)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.quote.INVALID_TRANSITION),
      });
    }
  }

  private async assertReadyToSend(current: PublicQuote, id: string) {
    const linesCount = await this.repo.countLines(id);
    if (!current.state || !current.address || linesCount === 0) {
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

    const hasTier = ctx.tiers.some(
      (t) => t.productId === line.productId && t.numPersons === line.numPersons,
    );
    if (!hasTier) throw invalidLines();

    for (const selection of line.selections) {
      const group = ctx.groups.find(
        (g) => g.id === selection.optionGroupId && g.productId === line.productId,
      );
      if (!group?.isActive) throw invalidLines();

      if (group.selectionType === 'included') {
        if (selection.optionIds.length > 0) throw invalidLines();
        continue;
      }
      if (group.maxSelect != null && selection.optionIds.length > group.maxSelect)
        throw invalidLines();

      for (const optionId of selection.optionIds) {
        const option = ctx.options.find((o) => o.id === optionId && o.optionGroupId === group.id);
        if (!option?.isActive) throw invalidLines();
      }
    }
  }
}

function buildQuoteNumber(date: Date, seq: number): string {
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `quo${yyyymmdd}-${String(seq).padStart(6, '0')}`;
}

function addMonths(date: Date, months: number): string {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result.toISOString().slice(0, 10);
}
