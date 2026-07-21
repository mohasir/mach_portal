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
  notes: quotes.notes,
  subtotal: quotes.subtotal,
  discountType: quotes.discountType,
  discountValue: quotes.discountValue,
  discountAmount: quotes.discountAmount,
  taxRate: quotes.taxRate,
  taxAmount: quotes.taxAmount,
  total: quotes.total,
  depositRate: quotes.depositRate,
  depositAmount: quotes.depositAmount,
  stageId: quotes.stageId,
  validUntil: quotes.validUntil,
  createdById: quotes.createdById,
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
  notes: row.notes,
  subtotal: row.subtotal,
  discountType: row.discountType,
  discountValue: row.discountValue,
  discountAmount: row.discountAmount,
  taxRate: row.taxRate,
  taxAmount: row.taxAmount,
  total: row.total,
  depositRate: row.depositRate,
  depositAmount: row.depositAmount,
  stageId: row.stageId,
  validUntil: row.validUntil,
  createdById: row.createdById,
  pdfUrl: row.pdfUrl,
  pdfGeneratedAt: row.pdfGeneratedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export type QuoteResource = ReturnType<typeof quoteResource>;

export type QuoteWithNames = PublicQuote & { clientName: string; eventTypeName: string | null };

export const quoteListItemResource = (row: QuoteWithNames) => ({
  ...quoteResource(row),
  clientName: row.clientName,
  eventTypeName: row.eventTypeName,
});

export type QuoteCardRow = QuoteWithNames & {
  linesCount: number;
  eventId: string | null;
  depositPaid: boolean | null;
  staffAssignedCount: number;
};

export const quoteCardResource = (row: QuoteCardRow) => ({
  id: row.id,
  number: row.number,
  clientName: row.clientName,
  eventTypeName: row.eventTypeName,
  eventDate: row.eventDate,
  total: row.total,
  stageId: row.stageId,
  validUntil: row.validUntil,
  linesCount: row.linesCount,
  eventId: row.eventId,
  depositPaid: row.depositPaid,
  staffAssignedCount: row.staffAssignedCount,
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

export type QuoteDetailRow = QuoteWithNames & { createdByName: string | null };

export type StageHistoryRow = {
  fromStageId: number | null;
  toStageId: number;
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
) => ({
  ...quoteResource(quoteRow),
  clientName: quoteRow.clientName,
  eventTypeName: quoteRow.eventTypeName,
  createdByName: quoteRow.createdByName,
  stageHistory: historyRows,
  lines: buildQuoteLineDetails(lineRows, optionRows),
});

export type QuoteDetailResource = ReturnType<typeof buildQuoteDetail>;
