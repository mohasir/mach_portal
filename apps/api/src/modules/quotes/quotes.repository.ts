import { randomUUID } from 'node:crypto';
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { QuoteLineInput, QuoteStage, QuotesBoardQuery, QuotesListQuery } from '@repo/schemas';
import type { Database } from '../../db';
import {
  quotes,
  quoteLines,
  quoteLineOptions,
  clients,
  eventTypes,
  products,
  productPriceTiers,
  optionGroups,
  options,
} from '../../db/schema';
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
  stage: quotes.stage,
  createdAt: quotes.createdAt,
} as const;

const OPEN_STAGES = ['new', 'quoted', 'confirmed'] as const;
const TERMINAL_STAGES = ['completed', 'cancelled'] as const;

export class QuotesRepository {
  constructor(private db: Database) {}

  async findPaginated(query: QuotesListQuery) {
    const { page, pageSize, search, sortBy, sortDir, month, year, stage, state, clientId } = query;
    const where = and(
      search
        ? or(ilike(quotes.number, `%${search}%`), ilike(clients.name, `%${search}%`))
        : undefined,
      month ? sql`extract(month from ${quotes.eventDate}) = ${month}` : undefined,
      year ? sql`extract(year from ${quotes.eventDate}) = ${year}` : undefined,
      stage ? eq(quotes.stage, stage) : undefined,
      state ? eq(quotes.state, state) : undefined,
      clientId ? eq(quotes.clientId, clientId) : undefined,
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);

    const items = await this.db
      .select({ ...publicQuoteColumns, clientName: clients.name, eventTypeName: eventTypes.name })
      .from(quotes)
      .innerJoin(clients, eq(quotes.clientId, clients.id))
      .leftJoin(eventTypes, eq(quotes.eventTypeId, eventTypes.id))
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const total = await this.countAll(where);
    return { items, total };
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
      .select({ ...publicQuoteColumns, clientName: clients.name, eventTypeName: eventTypes.name })
      .from(quotes)
      .innerJoin(clients, eq(quotes.clientId, clients.id))
      .leftJoin(eventTypes, eq(quotes.eventTypeId, eventTypes.id))
      .where(eq(quotes.id, id))
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

    return { quoteRow, lineRows, optionRows };
  }

  findQuoteRow(id: string) {
    return this.db
      .select(publicQuoteColumns)
      .from(quotes)
      .where(eq(quotes.id, id))
      .limit(1)
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
        .select({ ...publicQuoteColumns, clientName: clients.name, eventTypeName: eventTypes.name })
        .from(quotes)
        .innerJoin(clients, eq(quotes.clientId, clients.id))
        .leftJoin(eventTypes, eq(quotes.eventTypeId, eventTypes.id));

    const [openRows, terminalRows] = await Promise.all([
      baseSelect().where(inArray(quotes.stage, OPEN_STAGES)).orderBy(asc(quotes.eventDate)),
      baseSelect()
        .where(
          and(
            inArray(quotes.stage, TERMINAL_STAGES),
            sql`extract(month from ${quotes.updatedAt}) = ${month}`,
            sql`extract(year from ${quotes.updatedAt}) = ${year}`,
          ),
        )
        .orderBy(desc(quotes.updatedAt)),
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

  async insertFull(quoteData: typeof quotes.$inferInsert, lines: QuoteLineInput[]) {
    return this.db.transaction(async (tx) => {
      const [quote] = await tx.insert(quotes).values(quoteData).returning(publicQuoteColumns);
      await this.insertLines(tx, quote!.id, lines);
      return quote!;
    });
  }

  async replaceLines(
    id: string,
    quoteData: Partial<typeof quotes.$inferInsert>,
    lines: QuoteLineInput[],
  ) {
    return this.db.transaction(async (tx) => {
      const [quote] = await tx
        .update(quotes)
        .set(quoteData)
        .where(eq(quotes.id, id))
        .returning(publicQuoteColumns);
      if (!quote) return undefined;
      await tx.delete(quoteLines).where(eq(quoteLines.quoteId, id));
      await this.insertLines(tx, id, lines);
      return quote;
    });
  }

  updateStage(id: string, stage: QuoteStage) {
    return this.db
      .update(quotes)
      .set({ stage })
      .where(eq(quotes.id, id))
      .returning(publicQuoteColumns)
      .then((r) => r[0]);
  }
}
