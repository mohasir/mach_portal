import { quotes, quoteLines, quoteLineOptions } from '../../db/schema';

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
  subtotal: quotes.subtotal,
  discountType: quotes.discountType,
  discountValue: quotes.discountValue,
  discountAmount: quotes.discountAmount,
  longDistanceAmount: quotes.longDistanceAmount,
  taxRate: quotes.taxRate,
  taxAmount: quotes.taxAmount,
  total: quotes.total,
  applyCardSurcharge: quotes.applyCardSurcharge,
  cardSurchargeRate: quotes.cardSurchargeRate,
  cardSurchargeAmount: quotes.cardSurchargeAmount,
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
} as const;

export const publicQuoteLineColumns = {
  id: quoteLines.id,
  quoteId: quoteLines.quoteId,
  productId: quoteLines.productId,
  numPersons: quoteLines.numPersons,
  subtotal: quoteLines.subtotal,
  sortOrder: quoteLines.sortOrder,
} as const;

export const publicQuoteLineOptionColumns = {
  id: quoteLineOptions.id,
  quoteLineId: quoteLineOptions.quoteLineId,
  optionId: quoteLineOptions.optionId,
  optionGroupId: quoteLineOptions.optionGroupId,
} as const;

export type PublicQuote = Pick<typeof quotes.$inferSelect, keyof typeof publicQuoteColumns>;
export type PublicQuoteLine = Pick<
  typeof quoteLines.$inferSelect,
  keyof typeof publicQuoteLineColumns
>;
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
  subtotal: row.subtotal,
  discountType: row.discountType,
  discountValue: row.discountValue,
  discountAmount: row.discountAmount,
  longDistanceAmount: row.longDistanceAmount,
  taxRate: row.taxRate,
  taxAmount: row.taxAmount,
  total: row.total,
  applyCardSurcharge: row.applyCardSurcharge,
  cardSurchargeRate: row.cardSurchargeRate,
  cardSurchargeAmount: row.cardSurchargeAmount,
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

export type QuoteListItemRow = QuoteWithNames & { linesCount: number };

export const quoteListItemResource = (row: QuoteListItemRow) => ({
  ...quoteResource(row),
  clientName: row.clientName,
  eventTypeName: row.eventTypeName,
  isComplete: isQuoteComplete(row, row.linesCount),
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
});

export type QuoteCardResource = ReturnType<typeof quoteCardResource>;

export type QuoteLineSelection = { optionGroupId: string; optionIds: string[] };
export type QuoteLineDetail = {
  id: string;
  productId: string;
  numPersons: number;
  subtotal: number;
  sortOrder: number;
  selections: QuoteLineSelection[];
};

export type QuoteDetailRow = QuoteWithNames & {
  createdByName: string | null;
  assignedToName: string | null;
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
        numPersons: line.numPersons,
        subtotal: line.subtotal,
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
) => ({
  ...quoteResource(quoteRow),
  clientName: quoteRow.clientName,
  eventTypeName: quoteRow.eventTypeName,
  createdByName: quoteRow.createdByName,
  assignedToName: quoteRow.assignedToName,
  isComplete: isQuoteComplete(quoteRow, lineRows.length),
  stageHistory: historyRows,
  assignmentHistory: assignmentHistoryRows,
  lines: buildQuoteLineDetails(lineRows, optionRows),
});

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
