import { summarizeLineTaxes } from '@repo/schemas';
import { quotes, quoteCharges, quoteLines, quoteLineOptions } from '../../db/schema';
import { unitRefColumns, unitRefResource, type UnitRef } from '../products/products.resource';

export const publicQuoteColumns = {
  id: quotes.id,
  seq: quotes.seq,
  number: quotes.number,
  clientId: quotes.clientId,
  eventTypeId: quotes.eventTypeId,
  eventDate: quotes.eventDate,
  eventTime: quotes.eventTime,
  state: quotes.state,
  address: quotes.address,
  city: quotes.city,
  notes: quotes.notes,
  clientNotes: quotes.clientNotes,
  subtotal: quotes.subtotal,
  discountType: quotes.discountType,
  discountValue: quotes.discountValue,
  discountAmount: quotes.discountAmount,
  taxAmount: quotes.taxAmount,
  total: quotes.total,
  depositRate: quotes.depositRate,
  depositAmount: quotes.depositAmount,
  stageId: quotes.stageId,
  isDraft: quotes.isDraft,
  selectOptionsAtQuote: quotes.selectOptionsAtQuote,
  validUntil: quotes.validUntil,
  createdById: quotes.createdById,
  assignedToId: quotes.assignedToId,
  pdfUrl: quotes.pdfUrl,
  pdfGeneratedAt: quotes.pdfGeneratedAt,
  createdAt: quotes.createdAt,
  updatedAt: quotes.updatedAt,
  archivedAt: quotes.archivedAt,
} as const;

export const publicQuoteLineColumns = {
  id: quoteLines.id,
  quoteId: quoteLines.quoteId,
  productId: quoteLines.productId,
  uomId: quoteLines.uomId,
  quantity: quoteLines.quantity,
  subtotal: quoteLines.subtotal,
  taxRate: quoteLines.taxRate,
  taxAmount: quoteLines.taxAmount,
  sortOrder: quoteLines.sortOrder,
} as const;

// A line reads its unit from its own `uomId`, never from the product it points at.
export const quoteLineWithUnitColumns = {
  ...publicQuoteLineColumns,
  unit: unitRefColumns,
} as const;

export const publicQuoteLineOptionColumns = {
  id: quoteLineOptions.id,
  quoteLineId: quoteLineOptions.quoteLineId,
  optionId: quoteLineOptions.optionId,
  optionGroupId: quoteLineOptions.optionGroupId,
} as const;

// The charge as it was applied: a copy of its type's name and kind, the value used (cents or a rate)
// and the amount it added. `chargeTypeId` only points back at the catalog.
export const publicQuoteChargeColumns = {
  id: quoteCharges.id,
  chargeTypeId: quoteCharges.chargeTypeId,
  name: quoteCharges.name,
  kind: quoteCharges.kind,
  value: quoteCharges.value,
  amount: quoteCharges.amount,
  sortOrder: quoteCharges.sortOrder,
} as const;

export type PublicQuoteCharge = Pick<
  typeof quoteCharges.$inferSelect,
  keyof typeof publicQuoteChargeColumns
>;

export const quoteChargeResource = (row: PublicQuoteCharge) => ({
  id: row.id,
  chargeTypeId: row.chargeTypeId,
  name: row.name,
  kind: row.kind,
  value: row.value,
  amount: row.amount,
  sortOrder: row.sortOrder,
});

export type QuoteChargeDetail = ReturnType<typeof quoteChargeResource>;

export const buildQuoteChargeDetails = (rows: PublicQuoteCharge[]): QuoteChargeDetail[] =>
  [...rows].sort((a, b) => a.sortOrder - b.sortOrder).map(quoteChargeResource);

export type PublicQuote = Pick<typeof quotes.$inferSelect, keyof typeof publicQuoteColumns>;
export type PublicQuoteLine = Pick<
  typeof quoteLines.$inferSelect,
  keyof typeof publicQuoteLineColumns
> & { unit: UnitRef };
export type PublicQuoteLineOption = Pick<
  typeof quoteLineOptions.$inferSelect,
  keyof typeof publicQuoteLineOptionColumns
>;

export const quoteResource = (row: PublicQuote) => ({
  id: row.id,
  seq: row.seq,
  number: row.number,
  clientId: row.clientId,
  eventTypeId: row.eventTypeId,
  eventDate: row.eventDate,
  eventTime: row.eventTime,
  state: row.state,
  address: row.address,
  city: row.city,
  notes: row.notes,
  clientNotes: row.clientNotes,
  subtotal: row.subtotal,
  discountType: row.discountType,
  discountValue: row.discountValue,
  discountAmount: row.discountAmount,
  taxAmount: row.taxAmount,
  total: row.total,
  depositRate: row.depositRate,
  depositAmount: row.depositAmount,
  stageId: row.stageId,
  isDraft: row.isDraft,
  selectOptionsAtQuote: row.selectOptionsAtQuote,
  validUntil: row.validUntil,
  createdById: row.createdById,
  assignedToId: row.assignedToId,
  pdfUrl: row.pdfUrl,
  pdfGeneratedAt: row.pdfGeneratedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export type QuoteResource = ReturnType<typeof quoteResource>;

export type QuoteWithNames = PublicQuote & { clientName: string; eventTypeName: string | null };

// Mirrors the "ready to send" gate enforced server-side in quotes.service.ts (assertReadyToSend) —
// a quote can only leave PENDING/draft once it has a state, an address, a city and at least one line.
export const isQuoteComplete = (
  row: Pick<PublicQuote, 'state' | 'address' | 'city'>,
  linesCount: number,
): boolean => !!row.state && !!row.address && !!row.city && linesCount > 0;

export type QuoteListItemRow = QuoteWithNames & {
  linesCount: number;
  createdByName: string | null;
  assignedToName: string | null;
  eventId: string | null;
};

export const quoteListItemResource = (row: QuoteListItemRow) => ({
  ...quoteResource(row),
  clientName: row.clientName,
  eventTypeName: row.eventTypeName,
  isComplete: isQuoteComplete(row, row.linesCount),
  createdByName: row.createdByName,
  assignedToName: row.assignedToName,
  eventId: row.eventId,
  isArchived: !!row.archivedAt,
});

export type QuoteCardRow = QuoteWithNames & {
  linesCount: number;
  createdByName: string | null;
  assignedToName: string | null;
  eventId: string | null;
  depositPaid: boolean | null;
};

export const quoteCardResource = (row: QuoteCardRow) => ({
  id: row.id,
  number: row.number,
  clientName: row.clientName,
  eventTypeName: row.eventTypeName,
  eventDate: row.eventDate,
  total: row.total,
  stageId: row.stageId,
  isDraft: row.isDraft,
  isComplete: isQuoteComplete(row, row.linesCount),
  validUntil: row.validUntil,
  linesCount: row.linesCount,
  createdByName: row.createdByName,
  assignedToId: row.assignedToId,
  assignedToName: row.assignedToName,
  eventId: row.eventId,
  depositPaid: row.depositPaid,
  isArchived: !!row.archivedAt,
});

export type QuoteCardResource = ReturnType<typeof quoteCardResource>;

export type QuoteLineSelection = { optionGroupId: string; optionIds: string[] };
export type QuoteLineDetail = {
  id: string;
  productId: string;
  uomId: string;
  unit: ReturnType<typeof unitRefResource>;
  quantity: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  sortOrder: number;
  selections: QuoteLineSelection[];
};

export type QuoteDetailRow = QuoteWithNames & {
  createdByName: string | null;
  assignedToName: string | null;
  eventId: string | null;
};

export type StageHistoryRow = {
  fromStageId: number | null;
  toStageId: number;
  changedByName: string | null;
  changedAt: Date;
};

export type AssignmentHistoryRow = {
  fromUserName: string | null;
  toUserName: string | null;
  changedByName: string | null;
  changedAt: Date;
};

export const buildQuoteLineDetails = (
  lineRows: PublicQuoteLine[],
  optionRows: PublicQuoteLineOption[],
): QuoteLineDetail[] =>
  lineRows
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((line) => {
      const lineOptions = optionRows.filter((o) => o.quoteLineId === line.id);
      const groupIds = [...new Set(lineOptions.map((o) => o.optionGroupId))];
      return {
        id: line.id,
        productId: line.productId,
        uomId: line.uomId,
        unit: unitRefResource(line.unit),
        quantity: line.quantity,
        subtotal: line.subtotal,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        sortOrder: line.sortOrder,
        selections: groupIds.map((optionGroupId) => ({
          optionGroupId,
          optionIds: lineOptions
            .filter((o) => o.optionGroupId === optionGroupId)
            .map((o) => o.optionId),
        })),
      };
    });

export const buildQuoteDetail = (
  quoteRow: QuoteDetailRow,
  lineRows: PublicQuoteLine[],
  optionRows: PublicQuoteLineOption[],
  historyRows: StageHistoryRow[],
  assignmentHistoryRows: AssignmentHistoryRow[],
  chargeRows: PublicQuoteCharge[],
) => {
  const lines = buildQuoteLineDetails(lineRows, optionRows);
  return {
    ...quoteResource(quoteRow),
    clientName: quoteRow.clientName,
    eventTypeName: quoteRow.eventTypeName,
    createdByName: quoteRow.createdByName,
    assignedToName: quoteRow.assignedToName,
    eventId: quoteRow.eventId,
    isArchived: !!quoteRow.archivedAt,
    isComplete: isQuoteComplete(quoteRow, lineRows.length),
    stageHistory: historyRows,
    assignmentHistory: assignmentHistoryRows,
    lines,
    taxBreakdown: summarizeLineTaxes(lines, quoteRow.taxAmount),
    charges: buildQuoteChargeDetails(chargeRows),
  };
};

export type QuoteDetailResource = ReturnType<typeof buildQuoteDetail>;

export type QuoteAvailabilityConflictRow = {
  id: string;
  number: string;
  clientName: string;
  eventTypeName: string | null;
};

export const quoteAvailabilityConflictResource = (row: QuoteAvailabilityConflictRow) => ({
  id: row.id,
  number: row.number,
  clientName: row.clientName,
  eventTypeName: row.eventTypeName,
});
