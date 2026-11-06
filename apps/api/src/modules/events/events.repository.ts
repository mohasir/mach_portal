import {
  and,
  asc,
  desc,
  count,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  QUOTE_STAGE,
  type AssignStaffInput,
  type EventLineSelectionInput,
  type EventsCalendarQuery,
  type EventsListQuery,
  type RegisterEventPaymentInput,
  type RemoveStaffInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import {
  clients,
  events,
  eventHistory,
  eventPayments,
  eventPaymentAttachments,
  eventReschedules,
  eventStaff,
  eventTypes,
  notifications,
  optionGroups,
  quoteLineOptions,
  quoteLines,
  quotes,
  rescheduleReasons,
  staff,
  user,
} from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicQuoteLineColumns, publicQuoteLineOptionColumns } from '../quotes/quotes.resource';
import { staffBusyOnDate } from '../staff/staff.availability';
import {
  publicEventColumns,
  type EventStaffRow,
  type RescheduleWrite,
  type StaffConflictRow,
} from './events.resource';
import { containsPattern } from '../../lib/utils/search';

const sortColumns = {
  eventDate: events.eventDate,
  totalAmount: events.totalAmount,
  createdAt: events.createdAt,
} as const;

const assignedToUser = alias(user, 'assigned_to_user');

// Single source of truth for "selections pending": some line of the event's quote has an
// active `select` group with no option chosen. Matches the per-station count shown in the UI.
// Only valid in a WHERE clause (see findById).
const selectionsIncomplete = (tenantId: string) => sql<boolean>`exists (
  select 1 from ${quoteLines}
  inner join ${optionGroups} on ${optionGroups.productId} = ${quoteLines.productId}
    and ${tenantEq(optionGroups, tenantId)}
  where ${quoteLines.quoteId} = ${events.quoteId}
    and ${tenantEq(quoteLines, tenantId)}
    and ${optionGroups.selectionType} = 'select'
    and ${optionGroups.isActive}
    and not exists (
      select 1 from ${quoteLineOptions}
      where ${quoteLineOptions.quoteLineId} = ${quoteLines.id}
        and ${quoteLineOptions.optionGroupId} = ${optionGroups.id}
        and ${tenantEq(quoteLineOptions, tenantId)}
    )
)`;

type AttachmentInsert = Omit<typeof eventPaymentAttachments.$inferInsert, 'tenantId'>;

export class EventsRepository {
  constructor(
    private db: Database,
    readonly tenantId: string,
  ) {}

  // Every joined tenant table is matched inside its own ON clause, so a row pointing at another
  // tenant's data reads as missing (left joins) or is dropped (inner joins) instead of leaking.
  private quoteJoin() {
    return and(eq(events.quoteId, quotes.id), tenantEq(quotes, this.tenantId));
  }

  private clientJoin() {
    return and(eq(events.clientId, clients.id), tenantEq(clients, this.tenantId));
  }

  private eventTypeJoin() {
    return and(eq(events.eventTypeId, eventTypes.id), tenantEq(eventTypes, this.tenantId));
  }

  private staffJoin() {
    return and(eq(eventStaff.staffId, staff.id), tenantEq(staff, this.tenantId));
  }

  private eventWhere(id: string) {
    return and(eq(events.id, id), tenantEq(events, this.tenantId));
  }

  // Events have no owner of their own — they're 1:1 with the quote that spawned them,
  // so 'own' scope (resolveResourceScope) means "quote I created OR quote assigned to me".
  private ownerFilter(ownerId?: string): SQL | undefined {
    return ownerId
      ? or(eq(quotes.createdById, ownerId), eq(quotes.assignedToId, ownerId))
      : undefined;
  }

  // Pre-check for mutations that don't already join `quotes` (staff, payments,
  // attachments, selections) — centralizes the "not archived" + "own" gate so each
  // service method just calls this once instead of re-deriving it per query. Runs
  // unconditionally (unlike a plain ownerFilter check) so an 'all'-scope caller
  // (admin/superadmin) is blocked from acting on an archived event too — ownerFilter
  // itself only adds a restriction when ownerId is set, so this stays a no-op filter
  // for 'all' scope beyond the archived check.
  async isAccessible(eventId: string, ownerId?: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: events.id })
      .from(events)
      .innerJoin(quotes, this.quoteJoin())
      .where(and(this.eventWhere(eventId), isNull(quotes.archivedAt), this.ownerFilter(ownerId)))
      .limit(1);
    return !!row;
  }

  private baseSelect() {
    const totalPaidSubquery = this.db
      .select({ value: sql<number>`coalesce(sum(${eventPayments.amount}), 0)` })
      .from(eventPayments)
      .where(and(eq(eventPayments.eventId, events.id), tenantEq(eventPayments, this.tenantId)));

    return this.db
      .select({
        ...publicEventColumns,
        clientName: clients.name,
        eventTypeName: eventTypes.name,
        eventTypeColor: eventTypes.color,
        quoteNumber: quotes.number,
        quoteCancelled: sql<boolean>`${quotes.stageId} = ${QUOTE_STAGE.CANCELLED}`,
        totalPaid: sql<number>`(${totalPaidSubquery})`,
        createdByName: user.name,
        assignedToName: assignedToUser.name,
      })
      .from(events)
      .innerJoin(clients, this.clientJoin())
      .innerJoin(quotes, this.quoteJoin())
      .leftJoin(eventTypes, this.eventTypeJoin())
      .leftJoin(user, eq(quotes.createdById, user.id))
      .leftJoin(assignedToUser, eq(quotes.assignedToId, assignedToUser.id));
  }

  async findPaginated(query: EventsListQuery, ownerId?: string) {
    const { search, sortBy, sortDir, clientId, segment } = query;

    const today = new Date().toISOString().slice(0, 10);
    const segmentWhere =
      segment === 'upcoming'
        ? or(gte(events.eventDate, today), isNull(events.eventDate))
        : segment === 'past'
          ? lt(events.eventDate, today)
          : undefined;

    const where = and(
      tenantEq(events, this.tenantId),
      isNull(quotes.archivedAt),
      search ? ilike(clients.name, containsPattern(search)) : undefined,
      clientId ? eq(events.clientId, clientId) : undefined,
      segmentWhere,
      this.ownerFilter(ownerId),
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.baseSelect().where(where).orderBy(orderBy).limit(limit).offset(offset);
    const staffByEvent = await this.findStaffByEventIds(items.map((r) => r.id));
    const itemsWithStaff = items.map((row) => ({ ...row, staff: staffByEvent.get(row.id) ?? [] }));

    const total = paginate ? await this.countAll(where) : items.length;
    return { items: itemsWithStaff, total, paginate, page, pageSize };
  }

  private async findStaffByEventIds(eventIds: string[]) {
    if (eventIds.length === 0) return new Map<string, EventStaffRow[]>();
    const rows = await this.db
      .select({
        eventId: eventStaff.eventId,
        id: eventStaff.id,
        staffId: eventStaff.staffId,
        staffName: staff.name,
        role: eventStaff.role,
        assignedAt: eventStaff.assignedAt,
      })
      .from(eventStaff)
      .innerJoin(staff, this.staffJoin())
      .where(and(inArray(eventStaff.eventId, eventIds), tenantEq(eventStaff, this.tenantId)));

    const map = new Map<string, EventStaffRow[]>();
    for (const { eventId, ...rest } of rows) {
      const list = map.get(eventId) ?? [];
      list.push(rest);
      map.set(eventId, list);
    }
    return map;
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db
      .select({ value: count() })
      .from(events)
      .innerJoin(clients, this.clientJoin())
      .innerJoin(quotes, this.quoteJoin())
      .where(where);
    return row?.value ?? 0;
  }

  findCalendarRange(query: EventsCalendarQuery, ownerId?: string) {
    return this.baseSelect().where(
      and(
        tenantEq(events, this.tenantId),
        isNull(quotes.archivedAt),
        sql`extract(month from ${events.eventDate}) = ${query.month}`,
        sql`extract(year from ${events.eventDate}) = ${query.year}`,
        this.ownerFilter(ownerId),
      ),
    );
  }

  async findById(id: string, ownerId?: string) {
    const [eventRow] = await this.baseSelect()
      .where(and(this.eventWhere(id), isNull(quotes.archivedAt), this.ownerFilter(ownerId)))
      .limit(1);
    if (!eventRow) return undefined;

    const lineRows = await this.db
      .select(publicQuoteLineColumns)
      .from(quoteLines)
      .where(and(eq(quoteLines.quoteId, eventRow.quoteId), tenantEq(quoteLines, this.tenantId)));

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

    // Filter rather than select: in a single-table SELECT list Drizzle drops the table prefix
    // from every column, which leaves the correlated subquery ambiguous.
    const incompleteRows = await this.db
      .select({ id: events.id })
      .from(events)
      .where(and(this.eventWhere(id), selectionsIncomplete(this.tenantId)));

    const staffRows = await this.findStaff(id);
    const paymentRows = await this.findPayments(id);
    const attachmentRows = paymentRows.length
      ? await this.findAttachmentsByPaymentIds(paymentRows.map((p) => p.id))
      : [];
    const historyRows = await this.findHistory(id);
    const rescheduleRows = await this.findReschedules(id);

    return {
      eventRow,
      lineRows,
      optionRows,
      selectionsIncomplete: incompleteRows.length > 0,
      staffRows,
      paymentRows,
      attachmentRows,
      historyRows,
      rescheduleRows,
    };
  }

  findHistory(eventId: string) {
    return this.db
      .select({
        id: eventHistory.id,
        type: eventHistory.type,
        data: eventHistory.data,
        changedByName: user.name,
        changedAt: eventHistory.changedAt,
      })
      .from(eventHistory)
      .leftJoin(user, eq(eventHistory.changedById, user.id))
      .where(and(eq(eventHistory.eventId, eventId), tenantEq(eventHistory, this.tenantId)))
      .orderBy(desc(eventHistory.changedAt));
  }

  findStaff(eventId: string) {
    return this.db
      .select({
        id: eventStaff.id,
        staffId: eventStaff.staffId,
        staffName: staff.name,
        role: eventStaff.role,
        assignedAt: eventStaff.assignedAt,
      })
      .from(eventStaff)
      .innerJoin(staff, this.staffJoin())
      .where(and(eq(eventStaff.eventId, eventId), tenantEq(eventStaff, this.tenantId)));
  }

  findPayments(eventId: string) {
    return this.db
      .select({
        id: eventPayments.id,
        method: eventPayments.method,
        amount: eventPayments.amount,
        paidAt: eventPayments.paidAt,
        reference: eventPayments.reference,
        notes: eventPayments.notes,
        createdByName: user.name,
        createdAt: eventPayments.createdAt,
      })
      .from(eventPayments)
      .leftJoin(user, eq(eventPayments.createdById, user.id))
      .where(and(eq(eventPayments.eventId, eventId), tenantEq(eventPayments, this.tenantId)))
      .orderBy(desc(eventPayments.paidAt), desc(eventPayments.createdAt));
  }

  async registerPayment(
    eventId: string,
    data: RegisterEventPaymentInput,
    createdById: string | null,
  ) {
    return this.db.transaction(async (tx) => {
      const [event] = await tx
        .select({ totalAmount: events.totalAmount, depositAmount: quotes.depositAmount })
        .from(events)
        .innerJoin(quotes, this.quoteJoin())
        .where(this.eventWhere(eventId))
        .limit(1);
      if (!event) return undefined;

      const [sumRow] = await tx
        .select({ paidSoFar: sql<number>`coalesce(sum(${eventPayments.amount}), 0)::int` })
        .from(eventPayments)
        .where(and(eq(eventPayments.eventId, eventId), tenantEq(eventPayments, this.tenantId)));

      const totalPaid = (sumRow?.paidSoFar ?? 0) + data.amount;
      if (totalPaid > event.totalAmount) return 'exceeds-balance' as const;

      const [inserted] = await tx
        .insert(eventPayments)
        .values({ eventId, ...data, createdById, tenantId: this.tenantId })
        .returning({ id: eventPayments.id });
      await tx
        .update(events)
        .set({
          depositPaid: totalPaid >= event.depositAmount,
          balancePaid: totalPaid >= event.totalAmount,
        })
        .where(this.eventWhere(eventId));

      await tx.insert(eventHistory).values({
        eventId,
        type: 'payment_registered',
        data: { paymentId: inserted!.id, amount: data.amount, method: data.method },
        changedById: createdById,
        tenantId: this.tenantId,
      });

      return 'ok' as const;
    });
  }

  // Deletes the payment (its attachment rows cascade at the DB level — the caller still
  // needs the returned keys to clean up the actual files in R2, which don't cascade),
  // recomputes depositPaid/balancePaid from what's left, and logs the removal.
  async removePayment(eventId: string, paymentId: string, changedById: string) {
    return this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select({
          id: eventPayments.id,
          amount: eventPayments.amount,
          method: eventPayments.method,
        })
        .from(eventPayments)
        .where(
          and(
            eq(eventPayments.id, paymentId),
            eq(eventPayments.eventId, eventId),
            tenantEq(eventPayments, this.tenantId),
          ),
        )
        .limit(1);
      if (!payment) return undefined;

      const [event] = await tx
        .select({ totalAmount: events.totalAmount, depositAmount: quotes.depositAmount })
        .from(events)
        .innerJoin(quotes, this.quoteJoin())
        .where(this.eventWhere(eventId))
        .limit(1);
      if (!event) return undefined;

      const attachments = await tx
        .select({ key: eventPaymentAttachments.key })
        .from(eventPaymentAttachments)
        .where(
          and(
            eq(eventPaymentAttachments.paymentId, paymentId),
            tenantEq(eventPaymentAttachments, this.tenantId),
          ),
        );

      await tx
        .delete(eventPayments)
        .where(and(eq(eventPayments.id, paymentId), tenantEq(eventPayments, this.tenantId)));

      const [sumRow] = await tx
        .select({ paidSoFar: sql<number>`coalesce(sum(${eventPayments.amount}), 0)::int` })
        .from(eventPayments)
        .where(and(eq(eventPayments.eventId, eventId), tenantEq(eventPayments, this.tenantId)));
      const totalPaid = sumRow?.paidSoFar ?? 0;

      await tx
        .update(events)
        .set({
          depositPaid: totalPaid >= event.depositAmount,
          balancePaid: totalPaid >= event.totalAmount,
        })
        .where(this.eventWhere(eventId));

      await tx.insert(eventHistory).values({
        eventId,
        type: 'payment_removed',
        data: { paymentId: payment.id, amount: payment.amount, method: payment.method },
        changedById,
        tenantId: this.tenantId,
      });

      return { payment, attachmentKeys: attachments.map((a) => a.key) };
    });
  }

  async findPaymentById(paymentId: string) {
    const [row] = await this.db
      .select({ id: eventPayments.id, eventId: eventPayments.eventId })
      .from(eventPayments)
      .innerJoin(events, and(eq(eventPayments.eventId, events.id), tenantEq(events, this.tenantId)))
      .innerJoin(quotes, this.quoteJoin())
      .where(
        and(
          eq(eventPayments.id, paymentId),
          tenantEq(eventPayments, this.tenantId),
          isNull(quotes.archivedAt),
        ),
      )
      .limit(1);
    return row;
  }

  findAttachmentsByPaymentIds(paymentIds: string[]) {
    return this.db
      .select({
        id: eventPaymentAttachments.id,
        paymentId: eventPaymentAttachments.paymentId,
        key: eventPaymentAttachments.key,
        url: eventPaymentAttachments.url,
        fileName: eventPaymentAttachments.fileName,
        mimeType: eventPaymentAttachments.mimeType,
        size: eventPaymentAttachments.size,
        createdByName: user.name,
        createdAt: eventPaymentAttachments.createdAt,
      })
      .from(eventPaymentAttachments)
      .leftJoin(user, eq(eventPaymentAttachments.createdById, user.id))
      .where(
        and(
          inArray(eventPaymentAttachments.paymentId, paymentIds),
          tenantEq(eventPaymentAttachments, this.tenantId),
        ),
      )
      .orderBy(desc(eventPaymentAttachments.createdAt));
  }

  createAttachment(data: AttachmentInsert) {
    return this.db
      .insert(eventPaymentAttachments)
      .values({ ...data, tenantId: this.tenantId })
      .returning()
      .then((r) => r[0]);
  }

  async deleteAttachment(eventId: string, attachmentId: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: eventPaymentAttachments.id, key: eventPaymentAttachments.key })
        .from(eventPaymentAttachments)
        .innerJoin(
          eventPayments,
          and(
            eq(eventPaymentAttachments.paymentId, eventPayments.id),
            tenantEq(eventPayments, this.tenantId),
          ),
        )
        .where(
          and(
            eq(eventPaymentAttachments.id, attachmentId),
            eq(eventPayments.eventId, eventId),
            tenantEq(eventPaymentAttachments, this.tenantId),
          ),
        )
        .limit(1);
      if (!row) return undefined;

      await tx
        .delete(eventPaymentAttachments)
        .where(
          and(
            eq(eventPaymentAttachments.id, attachmentId),
            tenantEq(eventPaymentAttachments, this.tenantId),
          ),
        );
      return row;
    });
  }

  markCompleted(id: string, changedById: string) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(events)
        .set({ completedAt: new Date() })
        .where(this.eventWhere(id))
        .returning(publicEventColumns);
      if (!updated) return undefined;
      await tx.insert(eventHistory).values({
        eventId: id,
        type: 'completed',
        data: {},
        changedById,
        tenantId: this.tenantId,
      });
      return updated;
    });
  }

  /** Completed or cancelled (via its quote): no further changes allowed. */
  async isClosed(eventId: string) {
    const [row] = await this.db
      .select({
        completedAt: events.completedAt,
        quoteCancelled: sql<boolean>`${quotes.stageId} = ${QUOTE_STAGE.CANCELLED}`,
      })
      .from(events)
      .innerJoin(quotes, this.quoteJoin())
      .where(this.eventWhere(eventId))
      .limit(1);
    return !!row?.completedAt || !!row?.quoteCancelled;
  }

  async isStaffAssigned(eventId: string, staffId: string) {
    const [row] = await this.db
      .select({ id: eventStaff.id })
      .from(eventStaff)
      .where(
        and(
          eq(eventStaff.eventId, eventId),
          eq(eventStaff.staffId, staffId),
          tenantEq(eventStaff, this.tenantId),
        ),
      )
      .limit(1);
    return !!row;
  }

  private findStaffName(tx: Pick<Database, 'select'>, staffId: string) {
    return tx
      .select({ name: staff.name })
      .from(staff)
      .where(and(eq(staff.id, staffId), tenantEq(staff, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  // The event and the staff member are resolved inside the tenant by the service beforehand.
  assignStaff(data: AssignStaffInput, changedById: string) {
    return this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(eventStaff)
        .values({ ...data, tenantId: this.tenantId })
        .returning();
      const staffRow = await this.findStaffName(tx, data.staffId);
      await tx.insert(eventHistory).values({
        eventId: data.eventId,
        type: 'staff_assigned',
        data: { staffId: data.staffId, staffName: staffRow?.name ?? null, role: data.role ?? null },
        changedById,
        tenantId: this.tenantId,
      });
      return inserted;
    });
  }

  removeStaff(data: RemoveStaffInput, changedById: string) {
    return this.db.transaction(async (tx) => {
      const staffRow = await this.findStaffName(tx, data.staffId);
      const [deleted] = await tx
        .delete(eventStaff)
        .where(
          and(
            eq(eventStaff.eventId, data.eventId),
            eq(eventStaff.staffId, data.staffId),
            tenantEq(eventStaff, this.tenantId),
          ),
        )
        .returning({ id: eventStaff.id });
      if (!deleted) return undefined;
      await tx.insert(eventHistory).values({
        eventId: data.eventId,
        type: 'staff_removed',
        data: { staffId: data.staffId, staffName: staffRow?.name ?? null },
        changedById,
        tenantId: this.tenantId,
      });
      return deleted;
    });
  }

  async findForReschedule(eventId: string) {
    const [row] = await this.db
      .select({
        id: events.id,
        quoteId: events.quoteId,
        eventDate: events.eventDate,
        eventTime: events.eventTime,
        completedAt: events.completedAt,
        quoteCancelled: sql<boolean>`${quotes.stageId} = ${QUOTE_STAGE.CANCELLED}`,
        quoteNumber: quotes.number,
        clientName: clients.name,
      })
      .from(events)
      .innerJoin(quotes, this.quoteJoin())
      .innerJoin(clients, this.clientJoin())
      .where(and(this.eventWhere(eventId), isNull(quotes.archivedAt)))
      .limit(1);
    return row;
  }

  findReschedules(eventId: string) {
    return this.db
      .select({
        id: eventReschedules.id,
        fromDate: eventReschedules.fromDate,
        fromTime: eventReschedules.fromTime,
        toDate: eventReschedules.toDate,
        toTime: eventReschedules.toTime,
        reasonName: rescheduleReasons.name,
        note: eventReschedules.note,
        staffConflicts: eventReschedules.staffConflicts,
        rescheduledByName: user.name,
        rescheduledAt: eventReschedules.rescheduledAt,
      })
      .from(eventReschedules)
      .innerJoin(
        rescheduleReasons,
        and(
          eq(eventReschedules.reasonId, rescheduleReasons.id),
          tenantEq(rescheduleReasons, this.tenantId),
        ),
      )
      .leftJoin(user, eq(eventReschedules.rescheduledById, user.id))
      .where(and(eq(eventReschedules.eventId, eventId), tenantEq(eventReschedules, this.tenantId)))
      .orderBy(desc(eventReschedules.rescheduledAt));
  }

  // The quote is written too (only its date/time) so the calendar, double-booking check,
  // quote filters and PDF all keep reading a single date; the original survives in
  // event_reschedules.
  reschedule(data: RescheduleWrite) {
    const { eventId, quoteId, from, to, userId } = data;
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(events)
        .set({ eventDate: to.date, eventTime: to.time })
        .where(this.eventWhere(eventId))
        .returning(publicEventColumns);
      if (!updated) return undefined;

      await tx
        .update(quotes)
        .set({ eventDate: to.date, eventTime: to.time })
        .where(and(eq(quotes.id, quoteId), tenantEq(quotes, this.tenantId)));

      await tx.insert(eventReschedules).values({
        eventId,
        fromDate: from.date,
        fromTime: from.time,
        toDate: to.date,
        toTime: to.time,
        reasonId: data.reasonId,
        note: data.note ?? null,
        staffConflicts: data.staffConflicts,
        rescheduledById: userId,
        tenantId: this.tenantId,
      });

      await tx.insert(eventHistory).values({
        eventId,
        type: 'rescheduled',
        data: { from, to, reasonName: data.reasonName },
        changedById: userId,
        tenantId: this.tenantId,
      });

      // The reminder job dedupes by (type, entityId), so a reminder already sent for the old
      // date would block a new one forever; dropping it lets the next run recreate it.
      await tx
        .delete(notifications)
        .where(
          and(
            eq(notifications.type, 'event_selections_reminder'),
            eq(notifications.entityId, eventId),
            tenantEq(notifications, this.tenantId),
          ),
        );

      return updated;
    });
  }

  // Staff assigned to this event who are also on another busy event that day. A staff member
  // on two other events that day shows up once per clashing event.
  async findStaffConflicts(eventId: string, date: string): Promise<StaffConflictRow[]> {
    const otherAssignment = alias(eventStaff, 'other_assignment');
    const rows = await this.db
      .select({
        staffId: eventStaff.staffId,
        name: staff.name,
        conflictingEventId: events.id,
        quoteNumber: quotes.number,
        eventTime: events.eventTime,
      })
      .from(eventStaff)
      .innerJoin(staff, this.staffJoin())
      .innerJoin(
        otherAssignment,
        and(
          eq(otherAssignment.staffId, eventStaff.staffId),
          tenantEq(otherAssignment, this.tenantId),
        ),
      )
      .innerJoin(events, eq(otherAssignment.eventId, events.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      // staffBusyOnDate filters event_staff (this event's rows), events and quotes by tenant.
      .where(
        and(
          eq(eventStaff.eventId, eventId),
          ne(events.id, eventId),
          staffBusyOnDate(date, this.tenantId),
        ),
      );

    return rows.map((row) => ({
      staffId: row.staffId,
      name: row.name,
      conflictingEvent: {
        id: row.conflictingEventId,
        quoteNumber: row.quoteNumber,
        eventTime: row.eventTime,
      },
    }));
  }

  // Candidates for the "selections pending" reminder job (jobs/eventReminders.job.ts) — the
  // actual deadline math (vs. optionsSelectionDeadlineDays) happens in JS, not here.
  findPendingSelectionsCandidates() {
    return this.db
      .select({
        id: events.id,
        eventDate: events.eventDate,
        quoteNumber: quotes.number,
        clientName: clients.name,
      })
      .from(events)
      .innerJoin(quotes, this.quoteJoin())
      .innerJoin(clients, this.clientJoin())
      .where(
        and(
          tenantEq(events, this.tenantId),
          selectionsIncomplete(this.tenantId),
          isNull(events.completedAt),
          isNotNull(events.eventDate),
          isNull(quotes.archivedAt),
          ne(quotes.stageId, QUOTE_STAGE.CANCELLED),
        ),
      );
  }

  async findForSelectionsUpdate(eventId: string) {
    const [row] = await this.db
      .select({ id: events.id, quoteId: events.quoteId })
      .from(events)
      .where(this.eventWhere(eventId))
      .limit(1);
    return row;
  }

  // Ownership of each quoteLineId (belongs to this event's quote) and the maxSelect/active-option
  // rules are validated in events.service.ts before this runs — this just replaces the rows.
  // The event is updated first so an event outside the tenant leaves every row untouched.
  updateSelections(eventId: string, selections: EventLineSelectionInput[], userId: string) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(events)
        .set({ selectionsConfirmedAt: new Date(), selectionsConfirmedById: userId })
        .where(this.eventWhere(eventId))
        .returning(publicEventColumns);
      if (!updated) return undefined;

      for (const selection of selections) {
        await tx
          .delete(quoteLineOptions)
          .where(
            and(
              eq(quoteLineOptions.quoteLineId, selection.quoteLineId),
              eq(quoteLineOptions.optionGroupId, selection.optionGroupId),
              tenantEq(quoteLineOptions, this.tenantId),
            ),
          );
        const optionIds = [...new Set(selection.optionIds)];
        if (optionIds.length > 0) {
          await tx.insert(quoteLineOptions).values(
            optionIds.map((optionId) => ({
              quoteLineId: selection.quoteLineId,
              optionId,
              optionGroupId: selection.optionGroupId,
              tenantId: this.tenantId,
            })),
          );
        }
      }

      await tx.insert(eventHistory).values({
        eventId,
        type: 'selections_updated',
        data: { linesCount: selections.length },
        changedById: userId,
        tenantId: this.tenantId,
      });
      return updated;
    });
  }
}
