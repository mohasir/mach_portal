import type { PaymentMethod } from '@repo/schemas';
import { events } from '../../db/schema';
import { subtractDays } from '../../lib/utils/date';
import {
  buildQuoteLineDetails,
  type PublicQuoteLine,
  type PublicQuoteLineOption,
} from '../quotes/quotes.resource';

export const publicEventColumns = {
  id: events.id,
  quoteId: events.quoteId,
  clientId: events.clientId,
  eventTypeId: events.eventTypeId,
  eventDate: events.eventDate,
  eventTime: events.eventTime,
  state: events.state,
  address: events.address,
  city: events.city,
  totalAmount: events.totalAmount,
  depositPaid: events.depositPaid,
  balancePaid: events.balancePaid,
  paymentMethod: events.paymentMethod,
  notes: events.notes,
  completedAt: events.completedAt,
  selectionsConfirmedAt: events.selectionsConfirmedAt,
  selectionsConfirmedById: events.selectionsConfirmedById,
  createdAt: events.createdAt,
  updatedAt: events.updatedAt,
} as const;

export type PublicEvent = Pick<typeof events.$inferSelect, keyof typeof publicEventColumns>;

export const eventResource = (row: PublicEvent) => ({ ...row });
export type EventResource = ReturnType<typeof eventResource>;

export type EventStatus = 'upcoming' | 'completed' | 'cancelled';

const deriveStatus = (row: { completedAt: Date | null; quoteCancelled: boolean }): EventStatus =>
  row.quoteCancelled ? 'cancelled' : row.completedAt ? 'completed' : 'upcoming';

export type EventWithNames = PublicEvent & {
  clientName: string;
  eventTypeName: string | null;
  quoteNumber: string;
  quoteCancelled: boolean;
};

export const eventListItemResource = (row: EventWithNames) => ({
  id: row.id,
  quoteId: row.quoteId,
  quoteNumber: row.quoteNumber,
  clientId: row.clientId,
  clientName: row.clientName,
  eventTypeId: row.eventTypeId,
  eventTypeName: row.eventTypeName,
  eventDate: row.eventDate,
  eventTime: row.eventTime,
  state: row.state,
  address: row.address,
  city: row.city,
  totalAmount: row.totalAmount,
  depositPaid: row.depositPaid,
  balancePaid: row.balancePaid,
  paymentMethod: row.paymentMethod,
  notes: row.notes,
  status: deriveStatus(row),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const eventCollectionResource = (rows: EventWithNames[]) => rows.map(eventListItemResource);
export type EventListItemResource = ReturnType<typeof eventListItemResource>;

export type EventCalendarRow = Pick<
  EventWithNames,
  | 'id'
  | 'eventDate'
  | 'eventTime'
  | 'clientName'
  | 'eventTypeName'
  | 'completedAt'
  | 'quoteCancelled'
>;

export const eventCalendarItemResource = (row: EventCalendarRow) => ({
  id: row.id,
  eventDate: row.eventDate,
  eventTime: row.eventTime,
  clientName: row.clientName,
  eventTypeName: row.eventTypeName,
  status: deriveStatus(row),
});
export type EventCalendarItemResource = ReturnType<typeof eventCalendarItemResource>;

export type EventStaffRow = {
  id: string;
  staffId: string;
  staffName: string;
  role: string | null;
  assignedAt: Date;
};

export type EventPaymentRow = {
  id: string;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: Date;
};

export type EventPaymentAttachmentRow = {
  id: string;
  paymentId: string;
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdByName: string | null;
  createdAt: Date;
};

export const eventPaymentAttachmentResource = (row: EventPaymentAttachmentRow) => ({
  id: row.id,
  url: row.url,
  fileName: row.fileName,
  mimeType: row.mimeType,
  size: row.size,
  createdByName: row.createdByName,
  createdAt: row.createdAt,
});
export type EventPaymentAttachmentResource = ReturnType<typeof eventPaymentAttachmentResource>;

export const buildEventPaymentDetails = (
  paymentRows: EventPaymentRow[],
  attachmentRows: EventPaymentAttachmentRow[],
) =>
  paymentRows.map((payment) => ({
    ...payment,
    attachments: attachmentRows
      .filter((a) => a.paymentId === payment.id)
      .map(eventPaymentAttachmentResource),
  }));

export type PaymentStatus = 'pending' | 'partial' | 'paid';

const derivePaymentStatus = (totalAmount: number, totalPaid: number): PaymentStatus =>
  totalPaid <= 0 ? 'pending' : totalPaid >= totalAmount ? 'paid' : 'partial';

export const buildEventDetail = (
  eventRow: EventWithNames,
  lineRows: PublicQuoteLine[],
  optionRows: PublicQuoteLineOption[],
  staffRows: EventStaffRow[],
  paymentRows: EventPaymentRow[],
  attachmentRows: EventPaymentAttachmentRow[],
  optionsSelectionDeadlineDays: number,
) => {
  const totalPaid = paymentRows.reduce((sum, p) => sum + p.amount, 0);
  const selectionsPending = !eventRow.selectionsConfirmedAt;
  return {
    ...eventListItemResource(eventRow),
    lines: buildQuoteLineDetails(lineRows, optionRows),
    staff: staffRows,
    payments: buildEventPaymentDetails(paymentRows, attachmentRows),
    totalPaid,
    paymentStatus: derivePaymentStatus(eventRow.totalAmount, totalPaid),
    selectionsPending,
    selectionsDeadline:
      selectionsPending && eventRow.eventDate
        ? subtractDays(eventRow.eventDate, optionsSelectionDeadlineDays)
        : null,
  };
};
export type EventDetailResource = ReturnType<typeof buildEventDetail>;
