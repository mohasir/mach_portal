import { TRPCError } from '@trpc/server';
import {
  canTransition,
  computeQuoteTotals,
  isValidChargeValue,
  normalizeChargeValue,
  paginationMeta,
  QUOTE_STAGE,
  TEMPLATE_TYPES,
  type CheckQuoteAvailabilityQuery,
  type CreateQuoteInput,
  type QuoteChargeInput,
  type QuoteLineInput,
  type QuoteStageId,
  type QuotesBoardQuery,
  type QuotesListQuery,
  type QuoteTotalsInput,
  type QuotesViewOptions,
  type UpdateQuoteInput,
} from '@repo/schemas';
import { featureNotEnabled } from '../../core/trpc/requireFeature';
import type { AfterCommit } from '../../core/trpc/tenantCtx';
import type { TenantRunner, Tx } from '../../db';
import { runInBackground } from '../../lib/background';
import { AppError, ErrorCodes } from '../../lib/errors';
import { generateQuotePdf } from '../../lib/pdfService/client';
import { ConfigRepository } from '../config/config.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import type { NotificationActor } from '../notifications/notifications.resource';
import type { ProductsRepository } from '../products/products.repository';
import { isQuotable } from '../products/products.pricing';
import { buildProductTree } from '../products/products.resource';
import { invalidChargeValue } from '../chargeTypes/chargeTypes.service';
import type { TemplatesRepository } from '../templates/templates.repository';
import { quotePdfTemplateResource } from '../templates/templates.resource';
import {
  QuotesRepository,
  type InvalidLine,
  type MissingRef,
  type PricedQuoteCharge,
  type PricedQuoteLine,
} from './quotes.repository';
import { buildQuotePdfPayload } from './quotes.pdf';
import { matchStoredLines, validateLineSelections, type CatalogContext } from './quotes.validation';
import {
  buildQuoteDetail,
  buildQuoteLineDetails,
  isQuoteComplete,
  quoteAvailabilityConflictResource,
  quoteCardResource,
  quoteListItemResource,
  buildQuoteChargeDetails,
  quoteResource,
  type PublicQuote,
  type PublicQuoteCharge,
  type PublicQuoteLine,
} from './quotes.resource';

const EDITABLE_STAGES: QuoteStageId[] = [QUOTE_STAGE.PENDING, QUOTE_STAGE.QUOTED];
const PDF_ALLOWED_STAGES: QuoteStageId[] = [QUOTE_STAGE.QUOTED, QUOTE_STAGE.CONFIRMED];

function canGeneratePdf(row: { stageId: number; isDraft: boolean }): boolean {
  return !row.isDraft || PDF_ALLOWED_STAGES.includes(row.stageId as QuoteStageId);
}

function configNotFound() {
  return new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.config.NOT_FOUND) });
}

function notFound() {
  return new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.quote.NOT_FOUND) });
}
const missingRefCodes = {
  client: ErrorCodes.client.NOT_FOUND,
  eventType: ErrorCodes.eventType.NOT_FOUND,
  user: ErrorCodes.user.NOT_FOUND,
} as const;

function refNotFound({ missingRef }: MissingRef) {
  return new TRPCError({ code: 'NOT_FOUND', cause: new AppError(missingRefCodes[missingRef]) });
}

function invalidLineRef({ invalidLine }: InvalidLine) {
  return invalidLine === 'unit' ? invalidLineUnit() : invalidLines();
}

function invalidLineUnit() {
  return new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.quote.INVALID_LINE_UNIT),
  });
}

function invalidLines() {
  return new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.quote.INVALID_LINES),
  });
}
function productNotQuotable() {
  return new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.product.NOT_QUOTABLE),
  });
}
function belowMinQuantity() {
  return new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.quote.BELOW_MIN_QUANTITY),
  });
}
function amountTooLarge() {
  return new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.quote.AMOUNT_TOO_LARGE),
  });
}
function chargeTypeNotFound() {
  return new TRPCError({
    code: 'NOT_FOUND',
    cause: new AppError(ErrorCodes.chargeType.NOT_FOUND),
  });
}
function chargeTypeInactive() {
  return new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.chargeType.INACTIVE),
  });
}
function pricingNotAllowed() {
  return new TRPCError({
    code: 'FORBIDDEN',
    cause: new AppError(ErrorCodes.quote.PRICING_NOT_ALLOWED),
  });
}

export type QuotePdfRepositories = {
  quotes: QuotesRepository;
  products: ProductsRepository;
  templates: TemplatesRepository;
};

// Holds no connection while the PDF service works: the reads and the final write each run in a
// short tenant transaction of their own, with repositories built on that transaction.
export class QuotePdfGenerator {
  constructor(
    private runInTenant: TenantRunner,
    private repositoriesFor: (tx: Tx) => QuotePdfRepositories,
    private priceTiersActive: boolean,
  ) {}

  async generate(id: string, ownerId?: string) {
    const payload = await this.runInTenant(async (tx) => {
      const repos = this.repositoriesFor(tx);
      const result = await repos.quotes.findById(id, ownerId);
      if (!result) throw notFound();
      if (!canGeneratePdf(result.quoteRow)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          cause: new AppError(ErrorCodes.quote.PDF_NOT_ALLOWED),
        });
      }

      const lines = buildQuoteLineDetails(result.lineRows, result.optionRows);
      // Inactive products stay in the tree so older quotes keep their line; the PDF itself
      // skips inactive groups and options (see quotes.pdf.ts).
      // Read without the cost: the PDF is sent to the client and never shows it.
      const { productRows, tierRows, groupRows, optionRows, lookups } =
        await repos.products.findTree(true);
      const catalog = buildProductTree(
        productRows,
        tierRows,
        groupRows,
        optionRows,
        this.priceTiersActive,
        lookups,
      );
      const templateRow = await repos.templates.findByType(TEMPLATE_TYPES.QUOTE_PDF);
      const { content: template } = quotePdfTemplateResource(templateRow);
      return buildQuotePdfPayload(
        result.quoteRow,
        lines,
        buildQuoteChargeDetails(result.chargeRows),
        catalog,
        template,
      );
    });

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

    const updated = await this.runInTenant((tx) =>
      this.repositoriesFor(tx).quotes.setPdfInfo(id, pdf),
    );
    if (!updated) throw notFound();
    return quoteResource(updated);
  }
}

export class QuotesService {
  constructor(
    private repo: QuotesRepository,
    private configRepo: ConfigRepository,
    private notificationsRepo: NotificationsRepository,
    private pdf: QuotePdfGenerator,
    private afterCommit: AfterCommit,
    private priceTiersActive: boolean,
    private eventsActive: boolean,
    private extraChargesActive: boolean,
  ) {}

  // The PDF is generated from the committed quote, on its own short transactions, so the request
  // neither waits on the PDF service nor fails with it.
  private generatePdfInBackground(id: string, label: string) {
    this.afterCommit(() => runInBackground(label, () => this.pdf.generate(id)));
  }

  // `hideStale` is a per-user view option, but it only applies while the app allows hiding stale
  // quotes: a client with an old config cache must not keep hiding them once an admin turns it off.
  private async allowedViewOptions<T extends QuotesViewOptions>(query: T): Promise<T> {
    if (!query.hideStale) return query;
    const appRow = await this.configRepo.findAppSettings();
    return appRow?.hideStaleQuotes ? query : { ...query, hideStale: false };
  }

  async list(query: QuotesListQuery, ownerId?: string) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(
      await this.allowedViewOptions(query),
      ownerId,
    );
    const resource = items.map(quoteListItemResource);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async getById(id: string, ownerId?: string, includeArchived = false) {
    const result = await this.repo.findById(id, ownerId, includeArchived);
    if (!result) throw notFound();
    return buildQuoteDetail(
      result.quoteRow,
      result.lineRows,
      result.optionRows,
      result.historyRows,
      result.assignmentHistoryRows,
      result.chargeRows,
    );
  }

  async board(query: QuotesBoardQuery, ownerId?: string) {
    const rows = await this.repo.findBoard(await this.allowedViewOptions(query), ownerId);
    type Card = ReturnType<typeof quoteCardResource>;
    const grouped: Record<QuoteStageId, Card[]> & { archived: Card[] } = {
      [QUOTE_STAGE.PENDING]: [],
      [QUOTE_STAGE.QUOTED]: [],
      [QUOTE_STAGE.CONFIRMED]: [],
      [QUOTE_STAGE.CANCELLED]: [],
      archived: [],
    };
    for (const row of rows) {
      const card = quoteCardResource(row);
      if (card.isArchived) grouped.archived.push(card);
      else grouped[row.stageId as QuoteStageId].push(card);
    }
    return grouped;
  }

  async checkAvailability(query: CheckQuoteAvailabilityQuery) {
    const rows = await this.repo.findByDateTime(
      query.eventDate,
      query.eventTime,
      query.excludeQuoteId,
    );
    return { conflicts: rows.map(quoteAvailabilityConflictResource) };
  }

  async create(input: CreateQuoteInput, userId: string, canManagePricing: boolean) {
    await this.validateLines(input.lines, canManagePricing);
    const charges = await this.resolveCharges(input.charges ?? [], []);

    const [appRow, productRates] = await Promise.all([
      this.configRepo.findAppSettings(),
      this.repo.findProductTaxRates(input.lines.map((l) => l.productId)),
    ]);
    if (!appRow) throw configNotFound();

    const now = new Date();
    const { totals, lines, pricedCharges } = priceQuote(
      input.lines,
      input.lines.map((l) => productTaxRate(productRates, l.productId)),
      charges,
      {
        discountType: input.discountType,
        discountValue: input.discountValue,
        depositRate: input.depositRate ?? appRow.depositRate,
      },
    );

    const validUntil = addMonths(now, appRow.quoteValidityMonths);

    const created = await this.repo.insertFull(
      {
        clientId: input.clientId,
        eventTypeId: input.eventTypeId ?? null,
        eventDate: input.eventDate ?? null,
        eventTime: input.eventTime ?? null,
        state: input.state ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        notes: input.notes ?? null,
        clientNotes: input.clientNotes ?? null,
        discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null,
        isDraft: input.isDraft,
        selectOptionsAtQuote: input.selectOptionsAtQuote,
        validUntil,
        createdById: userId,
        ...totals,
      },
      (seq) => buildQuoteNumber(now, seq),
      lines,
      input.newClient,
      pricedCharges,
    );
    if ('missingRef' in created) throw refNotFound(created);
    if ('invalidLine' in created) throw invalidLineRef(created);

    if (canGeneratePdf(created)) {
      this.generatePdfInBackground(created.id, 'background pdf generation failed');
    }

    return quoteResource(created);
  }

  async update(id: string, input: UpdateQuoteInput, canManagePricing: boolean, ownerId?: string) {
    const current = await this.repo.findQuoteRow(id, ownerId);
    if (!current) throw notFound();
    if (!EDITABLE_STAGES.includes(current.stageId as QuoteStageId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.quote.NOT_EDITABLE),
      });
    }
    // Lines kept as they are stay frozen, tax rate included; only new or modified ones are checked
    // against the catalog and take the product's current rate.
    const stored = await this.repo.findLinesWithOptions(id);
    const productIds = input.lines.map((l) => l.productId);
    const [currentUnits, productRates] = await Promise.all([
      this.repo.findProductUnits(productIds),
      this.repo.findProductTaxRates(productIds),
    ]);
    const matches = matchStoredLines(input.lines, storedLinesWithSelections(stored), currentUnits);
    const changed = input.lines.filter((_, index) => !matches[index]);
    if (!canManagePricing) assertFrozenUnitsOnlyReselected(changed, stored.lineRows, currentUnits);
    await this.validateLines(changed, canManagePricing);
    const charges = await this.resolveCharges(input.charges ?? [], await this.repo.findCharges(id));

    const { totals, lines, pricedCharges } = priceQuote(
      input.lines,
      input.lines.map(
        (l, index) => matches[index]?.taxRate ?? productTaxRate(productRates, l.productId),
      ),
      charges,
      {
        discountType: input.discountType,
        discountValue: input.discountValue,
        depositRate: input.depositRate ?? current.depositRate,
      },
    );

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
        clientNotes: input.clientNotes ?? null,
        discountType: input.discountType ?? null,
        discountValue: input.discountValue ?? null,
        isDraft: input.isDraft,
        selectOptionsAtQuote: input.selectOptionsAtQuote,
        ...totals,
      },
      lines,
      input.newClient,
      pricedCharges,
    );
    if (!updated) throw notFound();
    if ('missingRef' in updated) throw refNotFound(updated);
    if ('invalidLine' in updated) throw invalidLineRef(updated);

    // Editing a quote that's already a finished sales document (see canGeneratePdf) leaves
    // its PDF out of date — regenerate it in the background so the save itself doesn't wait
    // on the external PDF service; a failure here shouldn't fail the edit the caller is
    // actually waiting on.
    if (canGeneratePdf(updated)) {
      this.generatePdfInBackground(id, 'background pdf regeneration failed');
    }

    return quoteResource(updated);
  }

  async updateStage(id: string, stageId: QuoteStageId, userId: string, ownerId?: string) {
    const current = await this.repo.findQuoteRow(id, ownerId);
    if (!current) throw notFound();
    const fromStageId = current.stageId as QuoteStageId;
    this.assertTransition(fromStageId, stageId);
    if (stageId === QUOTE_STAGE.QUOTED) await this.assertReadyToSend(current, id);

    const updated = await this.repo.updateStage(id, fromStageId, stageId, userId);
    if (!updated) throw notFound();
    return quoteResource(updated);
  }

  async approve(id: string, userId: string, actor: NotificationActor, ownerId?: string) {
    const current = await this.repo.findQuoteRow(id, ownerId);
    if (!current) throw notFound();
    const fromStageId = current.stageId as QuoteStageId;
    this.assertTransition(fromStageId, QUOTE_STAGE.CONFIRMED);

    // Flow B (options already chosen at quote time) means the event is born resolved; Flow A
    // (default) leaves it pending until someone completes it from the event screen (§events.updateSelections).
    // Without the events module no event is derived, and activating the module later does not
    // create one retroactively.
    const updated = await this.repo.approve(
      id,
      fromStageId,
      userId,
      this.eventsActive
        ? {
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
          }
        : null,
    );
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

  async cancel(id: string, userId: string, actor: NotificationActor, ownerId?: string) {
    const current = await this.repo.findQuoteRow(id, ownerId);
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

  async canArchive(id: string, ownerId?: string) {
    const hasPayments = await this.repo.hasEventPayments(id, ownerId);
    return { canArchive: !hasPayments };
  }

  async archive(id: string, userId: string, ownerId?: string) {
    if (await this.repo.hasEventPayments(id, ownerId)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.quote.HAS_PAYMENTS),
      });
    }
    const archived = await this.repo.archiveById(id, userId, ownerId);
    if (!archived) throw notFound();
    return archived;
  }

  async assign(id: string, assignedToId: string | null, changedById: string) {
    const updated = await this.repo.assignById(id, assignedToId, changedById);
    if (!updated) throw notFound();
    if ('missingRef' in updated) throw refNotFound(updated);
    return quoteResource(updated);
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

  // A charge resent with the type and value it already has on the quote keeps its stored copy, even
  // if its type was edited or deactivated since; any other charge is read from the tenant's catalog
  // and must be active, with a value valid for its kind (the type's default when omitted). Without
  // the extraCharges add-on nothing can be added or changed, and the stored charges stay as they are
  // whatever the input holds, so editing the quote recalculates them without losing any.
  private async resolveCharges(
    input: readonly QuoteChargeInput[],
    stored: readonly PublicQuoteCharge[],
  ): Promise<SettledCharge[]> {
    const keptCopy = (charge: QuoteChargeInput) =>
      stored.find(
        (s) =>
          s.chargeTypeId === charge.chargeTypeId &&
          (charge.value === undefined || normalizeChargeValue(s.kind, charge.value) === s.value),
      );

    if (!this.extraChargesActive) {
      if (input.some((charge) => !keptCopy(charge))) throw featureNotEnabled('extraCharges');
      return stored.map(settledFromStored);
    }

    const types = await this.repo.findChargeTypes(
      input.filter((charge) => !keptCopy(charge)).map((charge) => charge.chargeTypeId),
    );
    return input.map((charge) => {
      const kept = keptCopy(charge);
      if (kept) return settledFromStored(kept);
      const type = types.find((t) => t.id === charge.chargeTypeId);
      if (!type) throw chargeTypeNotFound();
      if (!type.isActive) throw chargeTypeInactive();
      const value = charge.value ?? type.defaultValue;
      if (!isValidChargeValue(type.kind, value)) throw invalidChargeValue();
      return {
        chargeTypeId: type.id,
        name: type.name,
        kind: type.kind,
        value: normalizeChargeValue(type.kind, value),
      };
    });
  }

  // Revalidates every line against the live catalog (mach-bar-domain.md D16/D17) — the
  // builder UI already prevents this, this is the server-side boundary.
  private async validateLines(lines: QuoteLineInput[], canManagePricing: boolean) {
    if (lines.length === 0) return;
    const productIds = lines.map((l) => l.productId);
    const [ctx, currentUnits] = await Promise.all([
      this.repo.loadCatalogContext(productIds),
      this.repo.findProductUnits(productIds),
    ]);
    for (const line of lines) {
      const frozenUnit = !!line.uomId && line.uomId !== currentUnits.get(line.productId);
      this.validateLine(line, ctx, canManagePricing, frozenUnit);
    }
  }

  // `frozenUnit`: the line keeps the unit it was quoted in, which is not the product's current one.
  // Its quantity and price are read in that old unit, so the product's present minimum, tiers and
  // price (all in the current unit) do not apply to it.
  private validateLine(
    line: QuoteLineInput,
    ctx: CatalogContext,
    canManagePricing: boolean,
    frozenUnit: boolean,
  ) {
    const product = ctx.products.find((p) => p.id === line.productId);
    if (!product?.isActive) throw invalidLines();
    if (frozenUnit) {
      if (!validateLineSelections(line.productId, line.selections, ctx)) throw invalidLines();
      return;
    }

    const productTiers = ctx.tiers.filter((tier) => tier.productId === line.productId);
    if (!isQuotable(product, productTiers, this.priceTiersActive)) throw productNotQuotable();

    // MANAGE_LINE_PRICING may quote below the product minimum, like it may set the subtotal.
    if (!canManagePricing && line.quantity < product.minQuantity) throw belowMinQuantity();

    // Only MANAGE_LINE_PRICING (admin/superadmin) may set a subtotal that deviates from the
    // catalog — everyone else's lines must land on an active price tier or on price × quantity
    // (the builder UI only ever produces exact matches; this is the server-side boundary
    // against a hand-crafted payload).
    if (!canManagePricing) {
      const matchesTier =
        this.priceTiersActive &&
        productTiers.some(
          (tier) => tier.quantity === line.quantity && tier.price === line.subtotal,
        );
      const matchesPrice = product.price != null && line.subtotal === product.price * line.quantity;
      if (!matchesTier && !matchesPrice) throw pricingNotAllowed();
    }

    if (!validateLineSelections(line.productId, line.selections, ctx)) throw invalidLines();
  }
}

// Every product was resolved inside the tenant by validateLines, or the line is frozen and keeps
// its own rate; a product missing here is a line that never passed validation.
function productTaxRate(rates: ReadonlyMap<string, number>, productId: string): number {
  const rate = rates.get(productId);
  if (rate === undefined) throw invalidLines();
  return rate;
}

type SettledCharge = Omit<PricedQuoteCharge, 'amount'>;

const settledFromStored = (charge: PublicQuoteCharge): SettledCharge => ({
  chargeTypeId: charge.chargeTypeId,
  name: charge.name,
  kind: charge.kind,
  value: charge.value,
});

// Every amount is stored in an int4 column; past it the insert would fail as a server error.
const INT4_MAX = 2_147_483_647;
const fitsInt4 = (value: number) => value >= -INT4_MAX - 1 && value <= INT4_MAX;

function priceQuote(
  lines: QuoteLineInput[],
  taxRates: number[],
  charges: SettledCharge[],
  rest: Omit<QuoteTotalsInput, 'lines' | 'charges'>,
) {
  if (!lines.every((line) => fitsInt4(line.subtotal))) throw amountTooLarge();
  const result = computeQuoteTotals({
    ...rest,
    lines: lines.map((line, index) => ({ subtotal: line.subtotal, taxRate: taxRates[index]! })),
    charges,
  });
  const amounts = [
    result.subtotal,
    result.discountAmount,
    result.taxAmount,
    result.total,
    result.depositAmount,
    ...result.lines.map((l) => l.taxAmount),
    ...result.charges.map((c) => c.amount),
  ];
  if (!amounts.every(fitsInt4)) throw amountTooLarge();
  const { lines: lineTotals, taxBreakdown: _breakdown, charges: chargeTotals, ...totals } = result;
  return {
    totals,
    pricedCharges: charges.map((charge, index): PricedQuoteCharge => ({
      ...charge,
      amount: chargeTotals[index]!.amount,
    })),
    lines: lines.map((line, index): PricedQuoteLine => ({
      ...line,
      taxRate: taxRates[index]!,
      taxAmount: lineTotals[index]!.taxAmount,
    })),
  };
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

// A line in a unit other than its product's current one cannot be repriced by a user without line
// pricing: its quantity and subtotal must stay as stored, so only its options may change. Anything
// else has to adopt the current unit, where it is validated like a new line.
function assertFrozenUnitsOnlyReselected(
  changed: readonly QuoteLineInput[],
  stored: readonly PublicQuoteLine[],
  currentUnits: ReadonlyMap<string, string>,
) {
  for (const line of changed) {
    if (!line.uomId || line.uomId === currentUnits.get(line.productId)) continue;
    const backed = stored.some(
      (s) =>
        s.productId === line.productId &&
        s.uomId === line.uomId &&
        s.quantity === line.quantity &&
        s.subtotal === line.subtotal,
    );
    if (!backed) throw invalidLineUnit();
  }
}

function storedLinesWithSelections({
  lineRows,
  optionRows,
}: Awaited<ReturnType<QuotesRepository['findLinesWithOptions']>>) {
  return lineRows.map((line) => {
    const byGroup = new Map<string, string[]>();
    for (const option of optionRows.filter((o) => o.quoteLineId === line.id)) {
      byGroup.set(option.optionGroupId, [
        ...(byGroup.get(option.optionGroupId) ?? []),
        option.optionId,
      ]);
    }
    return {
      productId: line.productId,
      uomId: line.uomId,
      quantity: line.quantity,
      subtotal: line.subtotal,
      taxRate: line.taxRate,
      selections: [...byGroup].map(([optionGroupId, optionIds]) => ({ optionGroupId, optionIds })),
    };
  });
}
