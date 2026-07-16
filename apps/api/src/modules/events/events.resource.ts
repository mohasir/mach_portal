import { events } from '../../db/schema';
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
  totalAmount: events.totalAmount,
  depositPaid: events.depositPaid,
  balancePaid: events.balancePaid,
  paymentMethod: events.paymentMethod,
  notes: events.notes,
  completedAt: events.completedAt,
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

export const buildEventDetail = (
  eventRow: EventWithNames,
  lineRows: PublicQuoteLine[],
  optionRows: PublicQuoteLineOption[],
  staffRows: EventStaffRow[],
) => ({
  ...eventListItemResource(eventRow),
  lines: buildQuoteLineDetails(lineRows, optionRows),
  staff: staffRows,
});
export type EventDetailResource = ReturnType<typeof buildEventDetail>;
