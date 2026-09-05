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
  eventStaff,
  eventTypes,
  quoteLineOptions,
  quoteLines,
  quotes,
  staff,
  user,
} from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicQuoteLineColumns, publicQuoteLineOptionColumns } from '../quotes/quotes.resource';
import { publicEventColumns, type EventStaffRow } from './events.resource';

const sortColumns = {
  eventDate: events.eventDate,
  totalAmount: events.totalAmount,
  createdAt: events.createdAt,
} as const;

const assignedToUser = alias(user, 'assigned_to_user');

export class EventsRepository {
  constructor(private db: Database) {}

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
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .where(and(eq(events.id, eventId), isNull(quotes.archivedAt), this.ownerFilter(ownerId)))
      .limit(1);
    return !!row;
  }

  private baseSelect() {
    const totalPaidSubquery = this.db
      .select({ value: sql<number>`coalesce(sum(${eventPayments.amount}), 0)` })
      .from(eventPayments)
      .where(eq(eventPayments.eventId, events.id));

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
      .innerJoin(clients, eq(events.clientId, clients.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .leftJoin(eventTypes, eq(events.eventTypeId, eventTypes.id))
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
      isNull(quotes.archivedAt),
      search ? ilike(clients.name, `%${search}%`) : undefined,
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
      .innerJoin(staff, eq(eventStaff.staffId, staff.id))
      .where(inArray(eventStaff.eventId, eventIds));

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
      .innerJoin(clients, eq(events.clientId, clients.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .where(where);
    return row?.value ?? 0;
  }

  findCalendarRange(query: EventsCalendarQuery, ownerId?: string) {
    return this.baseSelect().where(
      and(
        isNull(quotes.archivedAt),
        sql`extract(month from ${events.eventDate}) = ${query.month}`,
        sql`extract(year from ${events.eventDate}) = ${query.year}`,
        this.ownerFilter(ownerId),
      ),
    );
  }

  async findById(id: string, ownerId?: string) {
    const [eventRow] = await this.baseSelect()
      .where(and(eq(events.id, id), isNull(quotes.archivedAt), this.ownerFilter(ownerId)))
      .limit(1);
    if (!eventRow) return undefined;

    const lineRows = await this.db
      .select(publicQuoteLineColumns)
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, eventRow.quoteId));

    const lineIds = lineRows.map((l) => l.id);
    const optionRows = lineIds.length
      ? await this.db
          .select(publicQuoteLineOptionColumns)
          .from(quoteLineOptions)
          .where(inArray(quoteLineOptions.quoteLineId, lineIds))
      : [];

    const staffRows = await this.findStaff(id);
    const paymentRows = await this.findPayments(id);
    const attachmentRows = paymentRows.length
      ? await this.findAttachmentsByPaymentIds(paymentRows.map((p) => p.id))
      : [];
    const historyRows = await this.findHistory(id);

    return { eventRow, lineRows, optionRows, staffRows, paymentRows, attachmentRows, historyRows };
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
      .where(eq(eventHistory.eventId, eventId))
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
      .innerJoin(staff, eq(eventStaff.staffId, staff.id))
      .where(eq(eventStaff.eventId, eventId));
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
      .where(eq(eventPayments.eventId, eventId))
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
        .innerJoin(quotes, eq(events.quoteId, quotes.id))
        .where(eq(events.id, eventId))
        .limit(1);
      if (!event) return undefined;

      const [sumRow] = await tx
        .select({ paidSoFar: sql<number>`coalesce(sum(${eventPayments.amount}), 0)::int` })
        .from(eventPayments)
        .where(eq(eventPayments.eventId, eventId));

      const totalPaid = (sumRow?.paidSoFar ?? 0) + data.amount;
      if (totalPaid > event.totalAmount) return 'exceeds-balance' as const;

      const [inserted] = await tx
        .insert(eventPayments)
        .values({ eventId, ...data, createdById })
        .returning({ id: eventPayments.id });
      await tx
        .update(events)
        .set({
          depositPaid: totalPaid >= event.depositAmount,
          balancePaid: totalPaid >= event.totalAmount,
        })
        .where(eq(events.id, eventId));

      await tx.insert(eventHistory).values({
        eventId,
        type: 'payment_registered',
        data: { paymentId: inserted!.id, amount: data.amount, method: data.method },
        changedById: createdById,
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
        .where(and(eq(eventPayments.id, paymentId), eq(eventPayments.eventId, eventId)))
        .limit(1);
      if (!payment) return undefined;

      const attachments = await tx
        .select({ key: eventPaymentAttachments.key })
        .from(eventPaymentAttachments)
        .where(eq(eventPaymentAttachments.paymentId, paymentId));

      await tx.delete(eventPayments).where(eq(eventPayments.id, paymentId));

      const [event] = await tx
        .select({ totalAmount: events.totalAmount, depositAmount: quotes.depositAmount })
        .from(events)
        .innerJoin(quotes, eq(events.quoteId, quotes.id))
        .where(eq(events.id, eventId))
        .limit(1);

      const [sumRow] = await tx
        .select({ paidSoFar: sql<number>`coalesce(sum(${eventPayments.amount}), 0)::int` })
        .from(eventPayments)
        .where(eq(eventPayments.eventId, eventId));
      const totalPaid = sumRow?.paidSoFar ?? 0;

      await tx
        .update(events)
        .set({
          depositPaid: !!event && totalPaid >= event.depositAmount,
          balancePaid: !!event && totalPaid >= event.totalAmount,
        })
        .where(eq(events.id, eventId));

      await tx.insert(eventHistory).values({
        eventId,
        type: 'payment_removed',
        data: { paymentId: payment.id, amount: payment.amount, method: payment.method },
        changedById,
      });

      return { payment, attachmentKeys: attachments.map((a) => a.key) };
    });
  }

  async findPaymentById(paymentId: string) {
    const [row] = await this.db
      .select({ id: eventPayments.id, eventId: eventPayments.eventId })
      .from(eventPayments)
      .innerJoin(events, eq(eventPayments.eventId, events.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .where(and(eq(eventPayments.id, paymentId), isNull(quotes.archivedAt)))
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
      .where(inArray(eventPaymentAttachments.paymentId, paymentIds))
      .orderBy(desc(eventPaymentAttachments.createdAt));
  }

  createAttachment(data: typeof eventPaymentAttachments.$inferInsert) {
    return this.db
      .insert(eventPaymentAttachments)
      .values(data)
      .returning()
      .then((r) => r[0]);
  }

  async deleteAttachment(eventId: string, attachmentId: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: eventPaymentAttachments.id, key: eventPaymentAttachments.key })
        .from(eventPaymentAttachments)
        .innerJoin(eventPayments, eq(eventPaymentAttachments.paymentId, eventPayments.id))
        .where(
          and(eq(eventPaymentAttachments.id, attachmentId), eq(eventPayments.eventId, eventId)),
        )
        .limit(1);
      if (!row) return undefined;

      await tx.delete(eventPaymentAttachments).where(eq(eventPaymentAttachments.id, attachmentId));
      return row;
    });
  }

  markCompleted(id: string, changedById: string) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(events)
        .set({ completedAt: new Date() })
        .where(eq(events.id, id))
        .returning(publicEventColumns);
      if (!updated) return undefined;
      await tx.insert(eventHistory).values({ eventId: id, type: 'completed', data: {}, changedById });
      return updated;
    });
  }

  async isCompleted(eventId: string) {
    const [row] = await this.db
      .select({ completedAt: events.completedAt })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    return !!row?.completedAt;
  }

  async isStaffAssigned(eventId: string, staffId: string) {
    const [row] = await this.db
      .select({ id: eventStaff.id })
      .from(eventStaff)
      .where(and(eq(eventStaff.eventId, eventId), eq(eventStaff.staffId, staffId)))
      .limit(1);
    return !!row;
  }

  assignStaff(data: AssignStaffInput, changedById: string) {
    return this.db.transaction(async (tx) => {
      const [inserted] = await tx.insert(eventStaff).values(data).returning();
      const [staffRow] = await tx
        .select({ name: staff.name })
        .from(staff)
        .where(eq(staff.id, data.staffId))
        .limit(1);
      await tx.insert(eventHistory).values({
        eventId: data.eventId,
        type: 'staff_assigned',
        data: { staffId: data.staffId, staffName: staffRow?.name ?? null, role: data.role ?? null },
        changedById,
      });
      return inserted;
    });
  }

  removeStaff(data: RemoveStaffInput, changedById: string) {
    return this.db.transaction(async (tx) => {
      const [staffRow] = await tx
        .select({ name: staff.name })
        .from(staff)
        .where(eq(staff.id, data.staffId))
        .limit(1);
      const [deleted] = await tx
        .delete(eventStaff)
        .where(and(eq(eventStaff.eventId, data.eventId), eq(eventStaff.staffId, data.staffId)))
        .returning({ id: eventStaff.id });
      if (!deleted) return undefined;
      await tx.insert(eventHistory).values({
        eventId: data.eventId,
        type: 'staff_removed',
        data: { staffId: data.staffId, staffName: staffRow?.name ?? null },
        changedById,
      });
      return deleted;
    });
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
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .innerJoin(clients, eq(events.clientId, clients.id))
      .where(
        and(
          isNull(events.selectionsConfirmedAt),
          isNull(events.completedAt),
          isNotNull(events.eventDate),
          isNull(quotes.archivedAt),
          ne(quotes.stageId, QUOTE_STAGE.CANCELLED),
        ),
      );
  }

  async findForSelectionsUpdate(eventId: string) {
    const [row] = await this.db
      .select({ id: events.id, quoteId: events.quoteId, completedAt: events.completedAt })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    return row;
  }

  // Ownership of each quoteLineId (belongs to this event's quote) and the maxSelect/active-option
  // rules are validated in events.service.ts before this runs — this just replaces the rows.
  updateSelections(eventId: string, selections: EventLineSelectionInput[], userId: string) {
    return this.db.transaction(async (tx) => {
      for (const selection of selections) {
        await tx
          .delete(quoteLineOptions)
          .where(
            and(
              eq(quoteLineOptions.quoteLineId, selection.quoteLineId),
              eq(quoteLineOptions.optionGroupId, selection.optionGroupId),
            ),
          );
        const optionIds = [...new Set(selection.optionIds)];
        if (optionIds.length > 0) {
          await tx.insert(quoteLineOptions).values(
            optionIds.map((optionId) => ({
              quoteLineId: selection.quoteLineId,
              optionId,
              optionGroupId: selection.optionGroupId,
            })),
          );
        }
      }

      const [updated] = await tx
        .update(events)
        .set({ selectionsConfirmedAt: new Date(), selectionsConfirmedById: userId })
        .where(eq(events.id, eventId))
        .returning(publicEventColumns);
      if (updated) {
        await tx.insert(eventHistory).values({
          eventId,
          type: 'selections_updated',
          data: { linesCount: selections.length },
          changedById: userId,
        });
      }
      return updated;
    });
  }
}
