import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  not,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  QUOTE_STAGE,
  type CreateClientInput,
  type QuoteLineInput,
  type QuoteStageId,
  type QuotesBoardQuery,
  type QuotesFilters,
  type QuotesViewOptions,
  type QuotesListQuery,
} from '@repo/schemas';
import type { Database, Tx } from '../../db';
import { lockQuoteSeq } from '../../db/locks';
import {
  appSettings,
  quotes,
  quoteLines,
  quoteLineOptions,
  quoteStageHistory,
  quoteAssignmentHistory,
  clients,
  eventTypes,
  events,
  eventPayments,
  products,
  productPriceTiers,
  optionGroups,
  options,
  user,
} from '../../db/schema';
import { TenancyRepository } from '../../lib/tenancy/tenancy.repository';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { todayInBusinessTimezone } from '../../lib/utils/date';
import { containsPattern } from '../../lib/utils/search';
import {
  publicQuoteColumns,
  publicQuoteLineColumns,
  publicQuoteLineOptionColumns,
  type PublicQuote,
} from './quotes.resource';

// A referenced id from the input that does not resolve inside the tenant.
export type MissingRef = { missingRef: 'client' | 'eventType' | 'user' };

type QuoteInsert = Omit<typeof quotes.$inferInsert, 'tenantId' | 'clientId' | 'seq' | 'number'> & {
  clientId?: string;
};
type QuoteValues = Omit<Partial<typeof quotes.$inferInsert>, 'tenantId' | 'clientId'> & {
  clientId?: string;
};

const sortColumns = {
  number: quotes.number,
  eventDate: quotes.eventDate,
  total: quotes.total,
  stage: quotes.stageId,
  createdAt: quotes.createdAt,
} as const;

// Same rules as the web's isQuoteExpired/isQuotePastDue tags (day granularity), on the business
// calendar day rather than the DB's (UTC) `current_date`, which flips hours early in the US.
// Archived quotes are out of the flow, so they never count as stale. Wrapped in coalesce: a
// missing event date/validity makes the comparison NULL, and NOT NULL would wrongly drop the row
// when stale quotes are hidden.
const staleCondition = () => {
  const today = todayInBusinessTimezone();
  return sql<boolean>`coalesce(${and(
    isNull(quotes.archivedAt),
    or(
      and(
        inArray(quotes.stageId, [QUOTE_STAGE.PENDING, QUOTE_STAGE.QUOTED]),
        lt(quotes.eventDate, today),
      ),
      and(eq(quotes.stageId, QUOTE_STAGE.QUOTED), lt(quotes.validUntil, today)),
    ),
  )}, false)`;
};

const assignedToUser = alias(user, 'assigned_to_user');
const assignmentFromUser = alias(user, 'assignment_from_user');
const assignmentToUser = alias(user, 'assignment_to_user');
const assignmentChangedByUser = alias(user, 'assignment_changed_by_user');

export class QuotesRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  // Every joined tenant table is matched inside its own ON clause, so a row pointing at another
  // tenant's data reads as missing (left joins) or is dropped (inner joins) instead of leaking.
  private clientJoin() {
    return and(eq(quotes.clientId, clients.id), tenantEq(clients, this.tenantId));
  }

  private eventTypeJoin() {
    return and(eq(quotes.eventTypeId, eventTypes.id), tenantEq(eventTypes, this.tenantId));
  }

  private eventJoin() {
    return and(eq(events.quoteId, quotes.id), tenantEq(events, this.tenantId));
  }

  private quoteWhere(id: string) {
    return and(eq(quotes.id, id), tenantEq(quotes, this.tenantId));
  }

  // 'own' scope (resolveResourceScope) = created it OR it's assigned to me.
  private ownerFilter(ownerId?: string): SQL | undefined {
    return ownerId
      ? or(eq(quotes.createdById, ownerId), eq(quotes.assignedToId, ownerId))
      : undefined;
  }

  async findPaginated(query: QuotesListQuery, ownerId?: string) {
    const { sortBy, sortDir, month, year, stageId, clientId } = query;
    const where = and(
      tenantEq(quotes, this.tenantId),
      this.archivedWhere(query),
      this.filtersWhere(query),
      month ? sql`extract(month from ${quotes.eventDate}) = ${month}` : undefined,
      year ? sql`extract(year from ${quotes.eventDate}) = ${year}` : undefined,
      stageId ? eq(quotes.stageId, stageId) : undefined,
      clientId ? eq(quotes.clientId, clientId) : undefined,
      this.ownerFilter(ownerId),
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select({
        ...publicQuoteColumns,
        clientName: clients.name,
        eventTypeName: eventTypes.name,
        createdByName: user.name,
        assignedToName: assignedToUser.name,
        eventId: events.id,
      })
      .from(quotes)
      .innerJoin(clients, this.clientJoin())
      .leftJoin(eventTypes, this.eventTypeJoin())
      .leftJoin(user, eq(quotes.createdById, user.id))
      .leftJoin(assignedToUser, eq(quotes.assignedToId, assignedToUser.id))
      .leftJoin(events, this.eventJoin())
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
      .innerJoin(clients, this.clientJoin())
      .where(where);
    return row?.value ?? 0;
  }

  async findById(id: string, ownerId?: string, includeArchived = false) {
    const [quoteRow] = await this.db
      .select({
        ...publicQuoteColumns,
        clientName: clients.name,
        eventTypeName: eventTypes.name,
        createdByName: user.name,
        assignedToName: assignedToUser.name,
        eventId: events.id,
      })
      .from(quotes)
      .innerJoin(clients, this.clientJoin())
      .leftJoin(eventTypes, this.eventTypeJoin())
      .leftJoin(user, eq(quotes.createdById, user.id))
      .leftJoin(assignedToUser, eq(quotes.assignedToId, assignedToUser.id))
      .leftJoin(events, this.eventJoin())
      .where(
        and(
          this.quoteWhere(id),
          includeArchived ? undefined : isNull(quotes.archivedAt),
          this.ownerFilter(ownerId),
        ),
      )
      .limit(1);
    if (!quoteRow) return undefined;

    const lineRows = await this.db
      .select(publicQuoteLineColumns)
      .from(quoteLines)
      .where(and(eq(quoteLines.quoteId, id), tenantEq(quoteLines, this.tenantId)));

    const lineIds = lineRows.map((l) => l.id);
    const optionRows = lineIds.length
      ? await this.db
          .select(publicQuoteLineOptionColumns)
          .from(quoteLineOptions)
          .where(
            and(
              inArray(quoteLineOptions.quoteLineId, lineIds),
              tenantEq(quoteLineOptions, this.tenantId),
            ),
          )
      : [];

    const historyRows = await this.findStageHistory(id);
    const assignmentHistoryRows = await this.findAssignmentHistory(id);

    return { quoteRow, lineRows, optionRows, historyRows, assignmentHistoryRows };
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
      .where(
        and(eq(quoteStageHistory.quoteId, quoteId), tenantEq(quoteStageHistory, this.tenantId)),
      )
      .orderBy(asc(quoteStageHistory.changedAt));
  }

  findAssignmentHistory(quoteId: string) {
    return this.db
      .select({
        fromUserName: assignmentFromUser.name,
        toUserName: assignmentToUser.name,
        changedByName: assignmentChangedByUser.name,
        changedAt: quoteAssignmentHistory.changedAt,
      })
      .from(quoteAssignmentHistory)
      .leftJoin(assignmentFromUser, eq(quoteAssignmentHistory.fromUserId, assignmentFromUser.id))
      .leftJoin(assignmentToUser, eq(quoteAssignmentHistory.toUserId, assignmentToUser.id))
      .leftJoin(
        assignmentChangedByUser,
        eq(quoteAssignmentHistory.changedById, assignmentChangedByUser.id),
      )
      .where(
        and(
          eq(quoteAssignmentHistory.quoteId, quoteId),
          tenantEq(quoteAssignmentHistory, this.tenantId),
        ),
      )
      .orderBy(asc(quoteAssignmentHistory.changedAt));
  }

  setPdfInfo(id: string, { url, key }: { url: string; key: string }) {
    return this.db
      .update(quotes)
      .set({ pdfUrl: url, pdfKey: key, pdfGeneratedAt: new Date() })
      .where(this.quoteWhere(id))
      .returning(publicQuoteColumns)
      .then((r) => r[0]);
  }

  // Only while the quote is still pending with the rates the caller read: a concurrent send or
  // edit in between must not be repriced (sent quotes keep their rates). No row means it changed.
  updateRates(
    id: string,
    expected: { taxRate: number; cardSurchargeRate: number },
    values: Partial<Omit<typeof quotes.$inferInsert, 'id' | 'seq' | 'number' | 'tenantId'>>,
    ownerId?: string,
  ) {
    return this.db
      .update(quotes)
      .set(values)
      .where(
        and(
          this.quoteWhere(id),
          eq(quotes.stageId, QUOTE_STAGE.PENDING),
          eq(quotes.taxRate, expected.taxRate),
          eq(quotes.cardSurchargeRate, expected.cardSurchargeRate),
          isNull(quotes.archivedAt),
          this.ownerFilter(ownerId),
        ),
      )
      .returning(publicQuoteColumns)
      .then((r) => r[0]);
  }

  findQuoteRow(id: string, ownerId?: string) {
    return this.db
      .select(publicQuoteColumns)
      .from(quotes)
      .where(and(this.quoteWhere(id), isNull(quotes.archivedAt), this.ownerFilter(ownerId)))
      .limit(1)
      .then((r) => r[0]);
  }

  // Archiving is blocked once real money has been recorded against the quote's event —
  // that history has to stay visible/counted, so the correct action there is cancel, not
  // archive. Scoped by ownerId to avoid leaking a payment's existence on a quote the
  // caller doesn't own (archiveById's own 404 handles that).
  async hasEventPayments(quoteId: string, ownerId?: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: eventPayments.id })
      .from(eventPayments)
      .innerJoin(events, and(eq(eventPayments.eventId, events.id), tenantEq(events, this.tenantId)))
      .innerJoin(quotes, and(eq(events.quoteId, quotes.id), tenantEq(quotes, this.tenantId)))
      .where(
        and(
          eq(events.quoteId, quoteId),
          tenantEq(eventPayments, this.tenantId),
          this.ownerFilter(ownerId),
        ),
      )
      .limit(1);
    return !!row;
  }

  archiveById(id: string, archivedById: string, ownerId?: string) {
    return this.db
      .update(quotes)
      .set({ archivedAt: new Date(), archivedById })
      .where(and(this.quoteWhere(id), isNull(quotes.archivedAt), this.ownerFilter(ownerId)))
      .returning({ id: quotes.id })
      .then((r) => r[0]);
  }

  assignById(
    id: string,
    assignedToId: string | null,
    changedById: string,
  ): Promise<PublicQuote | MissingRef | undefined> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ assignedToId: quotes.assignedToId })
        .from(quotes)
        .where(and(this.quoteWhere(id), isNull(quotes.archivedAt)))
        .limit(1);
      if (!current) return undefined;
      if (
        assignedToId &&
        !(await new TenancyRepository(tx).isMemberOf(assignedToId, this.tenantId))
      ) {
        return { missingRef: 'user' as const };
      }

      const [updated] = await tx
        .update(quotes)
        .set({ assignedToId })
        .where(and(this.quoteWhere(id), isNull(quotes.archivedAt)))
        .returning(publicQuoteColumns);
      if (!updated) return undefined;

      await tx.insert(quoteAssignmentHistory).values({
        quoteId: id,
        fromUserId: current.assignedToId,
        toUserId: assignedToId,
        changedById,
        tenantId: this.tenantId,
      });

      return updated;
    });
  }

  countLines(quoteId: string) {
    return this.db
      .select({ value: count() })
      .from(quoteLines)
      .where(and(eq(quoteLines.quoteId, quoteId), tenantEq(quoteLines, this.tenantId)))
      .then((r) => r[0]?.value ?? 0);
  }

  async findBoard(query: QuotesBoardQuery, ownerId?: string) {
    const baseSelect = () =>
      this.db
        .select({
          ...publicQuoteColumns,
          clientName: clients.name,
          eventTypeName: eventTypes.name,
          createdByName: user.name,
          assignedToName: assignedToUser.name,
          eventId: events.id,
          depositPaid: events.depositPaid,
        })
        .from(quotes)
        .innerJoin(clients, this.clientJoin())
        .leftJoin(eventTypes, this.eventTypeJoin())
        .leftJoin(events, this.eventJoin())
        .leftJoin(user, eq(quotes.createdById, user.id))
        .leftJoin(assignedToUser, eq(quotes.assignedToId, assignedToUser.id));

    const ownerWhere = and(tenantEq(quotes, this.tenantId), this.ownerFilter(ownerId));
    const filtersWhere = this.filtersWhere(query);
    // Archived quotes get their own column instead of their stage's.
    const [activeRows, archivedRows] = await Promise.all([
      baseSelect()
        .where(and(isNull(quotes.archivedAt), filtersWhere, ownerWhere))
        .orderBy(desc(quotes.createdAt)),
      query.includeArchived
        ? baseSelect()
            .where(and(isNotNull(quotes.archivedAt), filtersWhere, ownerWhere))
            .orderBy(desc(quotes.archivedAt))
        : [],
    ]);

    const rows = [...activeRows, ...archivedRows];
    const lineCounts = await this.countLinesByQuote(rows.map((r) => r.id));
    return rows.map((row) => ({ ...row, linesCount: lineCounts.get(row.id) ?? 0 }));
  }

  // Both the list and the board join `clients`, which the search matches against.
  private archivedWhere({ includeArchived, archived }: QuotesFilters & QuotesViewOptions) {
    if (!includeArchived) return isNull(quotes.archivedAt);
    return archived ? isNotNull(quotes.archivedAt) : undefined;
  }

  private filtersWhere({
    search,
    states,
    assignedToIds,
    eventTypeIds,
    isDraft,
    stale,
    hideStale,
  }: QuotesFilters & QuotesViewOptions) {
    return and(
      search
        ? or(
            ilike(quotes.number, containsPattern(search)),
            ilike(clients.name, containsPattern(search)),
          )
        : undefined,
      states?.length ? inArray(quotes.state, states) : undefined,
      assignedToIds?.length ? inArray(quotes.assignedToId, assignedToIds) : undefined,
      eventTypeIds?.length ? inArray(quotes.eventTypeId, eventTypeIds) : undefined,
      isDraft !== undefined ? eq(quotes.isDraft, isDraft) : undefined,
      stale ? staleCondition() : undefined,
      hideStale && !search && !stale ? not(staleCondition()) : undefined,
    );
  }

  private async countLinesByQuote(quoteIds: string[]) {
    if (quoteIds.length === 0) return new Map<string, number>();
    const rows = await this.db
      .select({ quoteId: quoteLines.quoteId, value: count() })
      .from(quoteLines)
      .where(and(inArray(quoteLines.quoteId, quoteIds), tenantEq(quoteLines, this.tenantId)))
      .groupBy(quoteLines.quoteId);
    return new Map(rows.map((r) => [r.quoteId, r.value]));
  }

  // Advisory availability check (quotes.service.ts checkAvailability) — deliberately not
  // scoped by ownerFilter: the whole point is surfacing OTHER people's bookings too.
  findByDateTime(eventDate: string, eventTime: string, excludeQuoteId?: string) {
    return this.findBookings(eventDate, eventTime, excludeQuoteId);
  }

  findByDate(eventDate: string, excludeQuoteId?: string) {
    return this.findBookings(eventDate, undefined, excludeQuoteId);
  }

  private findBookings(eventDate: string, eventTime?: string, excludeQuoteId?: string) {
    return this.db
      .select({
        id: quotes.id,
        number: quotes.number,
        clientName: clients.name,
        eventTypeName: eventTypes.name,
      })
      .from(quotes)
      .innerJoin(clients, this.clientJoin())
      .leftJoin(eventTypes, this.eventTypeJoin())
      .where(
        and(
          tenantEq(quotes, this.tenantId),
          eq(quotes.eventDate, eventDate),
          eventTime ? eq(quotes.eventTime, eventTime) : undefined,
          ne(quotes.stageId, QUOTE_STAGE.CANCELLED),
          isNull(quotes.archivedAt),
          excludeQuoteId ? ne(quotes.id, excludeQuoteId) : undefined,
        ),
      );
  }

  // Must run inside the transaction that inserts the quote: the transaction-scoped advisory lock
  // serializes concurrent creations of one tenant until commit, so two of them can never read
  // the same max(seq). The key is namespaced, but hashtext is 32-bit: a collision with another
  // lock key only makes the two callers wait for each other, it never breaks the numbering.
  async nextSeq(tx: Tx): Promise<number> {
    await lockQuoteSeq(tx, this.tenantId);
    const [[maxRow], [settings]] = await Promise.all([
      tx
        .select({ value: sql<number>`coalesce(max(${quotes.seq}), 0)::int` })
        .from(quotes)
        .where(tenantEq(quotes, this.tenantId)),
      tx
        .select({ quoteSeqStart: appSettings.quoteSeqStart })
        .from(appSettings)
        .where(tenantEq(appSettings, this.tenantId))
        .limit(1),
    ]);
    return Math.max(maxRow?.value ?? 0, (settings?.quoteSeqStart ?? 1) - 1) + 1;
  }

  // Used by events.service.ts (updateSelections) to know which productId each quoteLineId
  // belongs to, and to confirm a given line actually belongs to this quote.
  findLinesByQuoteId(quoteId: string) {
    return this.db
      .select({ id: quoteLines.id, productId: quoteLines.productId })
      .from(quoteLines)
      .where(and(eq(quoteLines.quoteId, quoteId), tenantEq(quoteLines, this.tenantId)));
  }

  async loadCatalogContext(productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) return { products: [], tiers: [], groups: [], options: [] };

    const [productRows, tierRows, groupRows] = await Promise.all([
      this.db
        .select({ id: products.id, isActive: products.isActive })
        .from(products)
        .where(and(inArray(products.id, uniqueIds), tenantEq(products, this.tenantId))),
      this.db
        .select({
          productId: productPriceTiers.productId,
          numPersons: productPriceTiers.numPersons,
          price: productPriceTiers.price,
        })
        .from(productPriceTiers)
        .where(
          and(
            inArray(productPriceTiers.productId, uniqueIds),
            tenantEq(productPriceTiers, this.tenantId),
          ),
        ),
      this.db
        .select({
          id: optionGroups.id,
          productId: optionGroups.productId,
          selectionType: optionGroups.selectionType,
          maxSelect: optionGroups.maxSelect,
          isActive: optionGroups.isActive,
        })
        .from(optionGroups)
        .where(
          and(inArray(optionGroups.productId, uniqueIds), tenantEq(optionGroups, this.tenantId)),
        ),
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
          .where(and(inArray(options.optionGroupId, groupIds), tenantEq(options, this.tenantId)))
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
      tenantId: this.tenantId,
    }));
  }

  private buildOptionRows(lineRows: { id: string }[], lines: QuoteLineInput[]) {
    return lines.flatMap((line, index) =>
      line.selections.flatMap((selection) =>
        [...new Set(selection.optionIds)].map((optionId) => ({
          quoteLineId: lineRows[index]!.id,
          optionId,
          optionGroupId: selection.optionGroupId,
          tenantId: this.tenantId,
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

  // FK checks do not see tenants, so every referenced id from the input is resolved inside the
  // tenant before it is written.
  private async findMissingRef(
    tx: Tx,
    { clientId, eventTypeId }: { clientId?: string; eventTypeId?: string | null },
    newClient?: CreateClientInput,
  ): Promise<MissingRef | undefined> {
    if (!newClient) {
      const [client] = clientId
        ? await tx
            .select({ id: clients.id })
            .from(clients)
            .where(and(eq(clients.id, clientId), tenantEq(clients, this.tenantId)))
            .limit(1)
        : [];
      if (!client) return { missingRef: 'client' };
    }
    if (eventTypeId) {
      const [eventType] = await tx
        .select({ id: eventTypes.id })
        .from(eventTypes)
        .where(and(eq(eventTypes.id, eventTypeId), tenantEq(eventTypes, this.tenantId)))
        .limit(1);
      if (!eventType) return { missingRef: 'eventType' };
    }
    return undefined;
  }

  private async resolveClientId(
    tx: Tx,
    clientId: string | undefined,
    newClient?: CreateClientInput,
  ) {
    if (!newClient) return clientId!;
    const [created] = await tx
      .insert(clients)
      .values({ ...newClient, tenantId: this.tenantId })
      .returning({ id: clients.id });
    return created!.id;
  }

  // The seq is taken under the tenant lock of nextSeq, in the same transaction as the insert.
  async insertFull(
    quoteData: QuoteInsert,
    buildNumber: (seq: number) => string,
    lines: QuoteLineInput[],
    newClient?: CreateClientInput,
  ): Promise<PublicQuote | MissingRef> {
    return this.db.transaction(async (tx) => {
      const missing = await this.findMissingRef(tx, quoteData, newClient);
      if (missing) return missing;
      const clientId = await this.resolveClientId(tx, quoteData.clientId, newClient);
      const seq = await this.nextSeq(tx);
      const [quote] = await tx
        .insert(quotes)
        .values({ ...quoteData, clientId, seq, number: buildNumber(seq), tenantId: this.tenantId })
        .returning(publicQuoteColumns);
      await tx.insert(quoteStageHistory).values({
        quoteId: quote!.id,
        fromStageId: null,
        toStageId: quote!.stageId,
        changedById: quoteData.createdById ?? null,
        tenantId: this.tenantId,
      });
      await this.insertLines(tx, quote!.id, lines);
      return quote!;
    });
  }

  async replaceLines(
    id: string,
    quoteData: QuoteValues,
    lines: QuoteLineInput[],
    newClient?: CreateClientInput,
  ): Promise<PublicQuote | MissingRef | undefined> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: quotes.id })
        .from(quotes)
        .where(this.quoteWhere(id))
        .limit(1);
      if (!existing) return undefined;
      const missing = await this.findMissingRef(tx, quoteData, newClient);
      if (missing) return missing;
      const clientId = await this.resolveClientId(tx, quoteData.clientId, newClient);
      const [quote] = await tx
        .update(quotes)
        .set({ ...quoteData, clientId })
        .where(this.quoteWhere(id))
        .returning(publicQuoteColumns);
      if (!quote) return undefined;
      await tx
        .delete(quoteLines)
        .where(and(eq(quoteLines.quoteId, id), tenantEq(quoteLines, this.tenantId)));
      await this.insertLines(tx, id, lines);
      return quote;
    });
  }

  updateStage(id: string, fromStageId: QuoteStageId, toStageId: QuoteStageId, userId: string) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(quotes)
        .set({ stageId: toStageId, isDraft: false })
        .where(this.quoteWhere(id))
        .returning(publicQuoteColumns);
      if (!updated) return undefined;
      await tx.insert(quoteStageHistory).values({
        quoteId: id,
        fromStageId,
        toStageId,
        changedById: userId,
        tenantId: this.tenantId,
      });
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
    eventData: Omit<typeof events.$inferInsert, 'quoteId' | 'tenantId'>,
  ) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(quotes)
        .set({ stageId: QUOTE_STAGE.CONFIRMED })
        .where(this.quoteWhere(id))
        .returning(publicQuoteColumns);
      if (!updated) return undefined;
      await tx.insert(quoteStageHistory).values({
        quoteId: id,
        fromStageId,
        toStageId: QUOTE_STAGE.CONFIRMED,
        changedById: userId,
        tenantId: this.tenantId,
      });
      await tx.insert(events).values({ ...eventData, quoteId: id, tenantId: this.tenantId });
      return updated;
    });
  }
}
