import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import {
  QUOTE_STAGE,
  type CreateClientInput,
  type QuoteLineInput,
  type QuoteStageId,
  type QuotesBoardQuery,
  type QuotesListQuery,
} from '@repo/schemas';
import type { Database } from '../../db';
import {
  quotes,
  quoteLines,
  quoteLineOptions,
  quoteStageHistory,
  clients,
  eventTypes,
  events,
  eventStaff,
  staff,
  products,
  productPriceTiers,
  optionGroups,
  options,
  user,
} from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';
import {
  publicQuoteColumns,
  publicQuoteLineColumns,
  publicQuoteLineOptionColumns,
} from './quotes.resource';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const sortColumns = {
  number: quotes.number,
  eventDate: quotes.eventDate,
  total: quotes.total,
  stage: quotes.stageId,
  createdAt: quotes.createdAt,
} as const;

const OPEN_STAGES = [QUOTE_STAGE.PENDING, QUOTE_STAGE.QUOTED, QUOTE_STAGE.CONFIRMED] as const;
const TERMINAL_STAGES = [QUOTE_STAGE.CANCELLED] as const;

export class QuotesRepository {
  constructor(private db: Database) {}

  async findPaginated(query: QuotesListQuery) {
    const { search, sortBy, sortDir, month, year, stageId, state, clientId } = query;
    const where = and(
      isNull(quotes.archivedAt),
      search
        ? or(ilike(quotes.number, `%${search}%`), ilike(clients.name, `%${search}%`))
        : undefined,
      month ? sql`extract(month from ${quotes.eventDate}) = ${month}` : undefined,
      year ? sql`extract(year from ${quotes.eventDate}) = ${year}` : undefined,
      stageId ? eq(quotes.stageId, stageId) : undefined,
      state ? eq(quotes.state, state) : undefined,
      clientId ? eq(quotes.clientId, clientId) : undefined,
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select({ ...publicQuoteColumns, clientName: clients.name, eventTypeName: eventTypes.name })
      .from(quotes)
      .innerJoin(clients, eq(quotes.clientId, clients.id))
      .leftJoin(eventTypes, eq(quotes.eventTypeId, eventTypes.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const lineCounts = await this.countLinesByQuote(items.map((r) => r.id));
    const itemsWithLines = items.map((row) => ({
      ...row,
      linesCount: lineCounts.get(row.id) ?? 0,
    }));

    const total = paginate ? await this.countAll(where) : items.length;
    return { items: itemsWithLines, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db
      .select({ value: count() })
      .from(quotes)
      .innerJoin(clients, eq(quotes.clientId, clients.id))
      .where(where);
    return row?.value ?? 0;
  }

  async findById(id: string) {
    const [quoteRow] = await this.db
      .select({
        ...publicQuoteColumns,
        clientName: clients.name,
        eventTypeName: eventTypes.name,
        createdByName: user.name,
      })
      .from(quotes)
      .innerJoin(clients, eq(quotes.clientId, clients.id))
      .leftJoin(eventTypes, eq(quotes.eventTypeId, eventTypes.id))
      .leftJoin(user, eq(quotes.createdById, user.id))
      .where(and(eq(quotes.id, id), isNull(quotes.archivedAt)))
      .limit(1);
    if (!quoteRow) return undefined;

    const lineRows = await this.db
      .select(publicQuoteLineColumns)
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, id));

    const lineIds = lineRows.map((l) => l.id);
    const optionRows = lineIds.length
      ? await this.db
          .select(publicQuoteLineOptionColumns)
          .from(quoteLineOptions)
          .where(inArray(quoteLineOptions.quoteLineId, lineIds))
      : [];

    const historyRows = await this.findStageHistory(id);

    return { quoteRow, lineRows, optionRows, historyRows };
  }

  findStageHistory(quoteId: string) {
    return this.db
      .select({
        fromStageId: quoteStageHistory.fromStageId,
        toStageId: quoteStageHistory.toStageId,
        changedByName: user.name,
        changedAt: quoteStageHistory.changedAt,
      })
      .from(quoteStageHistory)
      .leftJoin(user, eq(quoteStageHistory.changedById, user.id))
      .where(eq(quoteStageHistory.quoteId, quoteId))
      .orderBy(asc(quoteStageHistory.changedAt));
  }

  setPdfInfo(id: string, { url, key }: { url: string; key: string }) {
    return this.db
      .update(quotes)
      .set({ pdfUrl: url, pdfKey: key, pdfGeneratedAt: new Date() })
      .where(eq(quotes.id, id))
      .returning(publicQuoteColumns)
      .then((r) => r[0]);
  }

  findQuoteRow(id: string) {
    return this.db
      .select(publicQuoteColumns)
      .from(quotes)
      .where(and(eq(quotes.id, id), isNull(quotes.archivedAt)))
      .limit(1)
      .then((r) => r[0]);
  }

  archiveById(id: string) {
    return this.db
      .update(quotes)
      .set({ archivedAt: new Date() })
      .where(and(eq(quotes.id, id), isNull(quotes.archivedAt)))
      .returning({ id: quotes.id })
      .then((r) => r[0]);
  }

  countLines(quoteId: string) {
    return this.db
      .select({ value: count() })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId))
      .then((r) => r[0]?.value ?? 0);
  }

  async findBoard(query: QuotesBoardQuery) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();

    const baseSelect = () =>
      this.db
        .select({
          ...publicQuoteColumns,
          clientName: clients.name,
          eventTypeName: eventTypes.name,
          eventId: events.id,
          depositPaid: events.depositPaid,
          staffMembers: sql<{ id: string; name: string }[]>`(
            select coalesce(
              json_agg(json_build_object('id', ${staff.id}, 'name', ${staff.name}) order by ${eventStaff.assignedAt}),
              '[]'
            )
            from ${eventStaff}
            inner join ${staff} on ${staff.id} = ${eventStaff.staffId}
            where ${eventStaff.eventId} = ${events.id}
          )`,
        })
        .from(quotes)
        .innerJoin(clients, eq(quotes.clientId, clients.id))
        .leftJoin(eventTypes, eq(quotes.eventTypeId, eventTypes.id))
        .leftJoin(events, eq(events.quoteId, quotes.id));

    const [openRows, terminalRows] = await Promise.all([
      baseSelect()
        .where(and(inArray(quotes.stageId, OPEN_STAGES), isNull(quotes.archivedAt)))
        .orderBy(desc(quotes.createdAt)),
      baseSelect()
        .where(
          and(
            inArray(quotes.stageId, TERMINAL_STAGES),
            isNull(quotes.archivedAt),
            sql`extract(month from ${quotes.updatedAt}) = ${month}`,
            sql`extract(year from ${quotes.updatedAt}) = ${year}`,
          ),
        )
        .orderBy(desc(quotes.createdAt)),
    ]);

    const rows = [...openRows, ...terminalRows];
    const lineCounts = await this.countLinesByQuote(rows.map((r) => r.id));
    return rows.map((row) => ({ ...row, linesCount: lineCounts.get(row.id) ?? 0 }));
  }

  private async countLinesByQuote(quoteIds: string[]) {
    if (quoteIds.length === 0) return new Map<string, number>();
    const rows = await this.db
      .select({ quoteId: quoteLines.quoteId, value: count() })
      .from(quoteLines)
      .where(inArray(quoteLines.quoteId, quoteIds))
      .groupBy(quoteLines.quoteId);
    return new Map(rows.map((r) => [r.quoteId, r.value]));
  }

  async getMaxSeq(): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`coalesce(max(${quotes.seq}), 0)` })
      .from(quotes);
    return row?.value ?? 0;
  }

  // Used by events.service.ts (updateSelections) to know which productId each quoteLineId
  // belongs to, and to confirm a given line actually belongs to this quote.
  findLinesByQuoteId(quoteId: string) {
    return this.db
      .select({ id: quoteLines.id, productId: quoteLines.productId })
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, quoteId));
  }

  async loadCatalogContext(productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) return { products: [], tiers: [], groups: [], options: [] };

    const [productRows, tierRows, groupRows] = await Promise.all([
      this.db
        .select({ id: products.id, isActive: products.isActive })
        .from(products)
        .where(inArray(products.id, uniqueIds)),
      this.db
        .select({
          productId: productPriceTiers.productId,
          numPersons: productPriceTiers.numPersons,
        })
        .from(productPriceTiers)
        .where(inArray(productPriceTiers.productId, uniqueIds)),
      this.db
        .select({
          id: optionGroups.id,
          productId: optionGroups.productId,
          selectionType: optionGroups.selectionType,
          maxSelect: optionGroups.maxSelect,
          isActive: optionGroups.isActive,
        })
        .from(optionGroups)
        .where(inArray(optionGroups.productId, uniqueIds)),
    ]);

    const groupIds = groupRows.map((g) => g.id);
    const optionRows = groupIds.length
      ? await this.db
          .select({
            id: options.id,
            optionGroupId: options.optionGroupId,
            isActive: options.isActive,
          })
          .from(options)
          .where(inArray(options.optionGroupId, groupIds))
      : [];

    return { products: productRows, tiers: tierRows, groups: groupRows, options: optionRows };
  }

  private buildLineRows(quoteId: string, lines: QuoteLineInput[]) {
    return lines.map((line, index) => ({
      id: randomUUID(),
      quoteId,
      productId: line.productId,
      numPersons: line.numPersons,
      subtotal: line.subtotal,
      sortOrder: index,
    }));
  }

  private buildOptionRows(lineRows: { id: string }[], lines: QuoteLineInput[]) {
    return lines.flatMap((line, index) =>
      line.selections.flatMap((selection) =>
        [...new Set(selection.optionIds)].map((optionId) => ({
          quoteLineId: lineRows[index]!.id,
          optionId,
          optionGroupId: selection.optionGroupId,
        })),
      ),
    );
  }

  private async insertLines(tx: Tx, quoteId: string, lines: QuoteLineInput[]) {
    const lineRows = this.buildLineRows(quoteId, lines);
    if (lineRows.length === 0) return;
    await tx.insert(quoteLines).values(lineRows);
    const optionRows = this.buildOptionRows(lineRows, lines);
    if (optionRows.length > 0) await tx.insert(quoteLineOptions).values(optionRows);
  }

  private async resolveClientId(
    tx: Tx,
    clientId: string | undefined,
    newClient?: CreateClientInput,
  ) {
    if (!newClient) return clientId!;
    const [created] = await tx.insert(clients).values(newClient).returning({ id: clients.id });
    return created!.id;
  }

  async insertFull(
    quoteData: Omit<typeof quotes.$inferInsert, 'clientId'> & { clientId?: string },
    lines: QuoteLineInput[],
    newClient?: CreateClientInput,
  ) {
    return this.db.transaction(async (tx) => {
      const clientId = await this.resolveClientId(tx, quoteData.clientId, newClient);
      const [quote] = await tx
        .insert(quotes)
        .values({ ...quoteData, clientId })
        .returning(publicQuoteColumns);
      await tx.insert(quoteStageHistory).values({
        quoteId: quote!.id,
        fromStageId: null,
        toStageId: quote!.stageId,
        changedById: quoteData.createdById ?? null,
      });
      await this.insertLines(tx, quote!.id, lines);
      return quote!;
    });
  }

  async replaceLines(
    id: string,
    quoteData: Omit<Partial<typeof quotes.$inferInsert>, 'clientId'> & { clientId?: string },
    lines: QuoteLineInput[],
    newClient?: CreateClientInput,
  ) {
    return this.db.transaction(async (tx) => {
      const clientId = await this.resolveClientId(tx, quoteData.clientId, newClient);
      const [quote] = await tx
        .update(quotes)
        .set({ ...quoteData, clientId })
        .where(eq(quotes.id, id))
        .returning(publicQuoteColumns);
      if (!quote) return undefined;
      await tx.delete(quoteLines).where(eq(quoteLines.quoteId, id));
      await this.insertLines(tx, id, lines);
      return quote;
    });
  }

  updateStage(id: string, fromStageId: QuoteStageId, toStageId: QuoteStageId, userId: string) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(quotes)
        .set({ stageId: toStageId, isDraft: false })
        .where(eq(quotes.id, id))
        .returning(publicQuoteColumns);
      if (!updated) return undefined;
      await tx
        .insert(quoteStageHistory)
        .values({ quoteId: id, fromStageId, toStageId, changedById: userId });
      return updated;
    });
  }

  // Approve → create the derived event, atomically (mach-bar-domain.md §11). The transition
  // matrix (no CONFIRMED→CONFIRMED edge) is what keeps this idempotent in practice — a second
  // approve on an already-confirmed quote never reaches here.
  approveWithEvent(
    id: string,
    fromStageId: QuoteStageId,
    userId: string,
    eventData: Omit<typeof events.$inferInsert, 'quoteId'>,
  ) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(quotes)
        .set({ stageId: QUOTE_STAGE.CONFIRMED })
        .where(eq(quotes.id, id))
        .returning(publicQuoteColumns);
      if (!updated) return undefined;
      await tx.insert(quoteStageHistory).values({
        quoteId: id,
        fromStageId,
        toStageId: QUOTE_STAGE.CONFIRMED,
        changedById: userId,
      });
      await tx.insert(events).values({ ...eventData, quoteId: id });
      return updated;
    });
  }
}
