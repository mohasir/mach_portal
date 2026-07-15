import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { stateSchema } from './enums';
import { optionalText } from './fields';

export const QUOTE_STAGES = ['new', 'quoted', 'confirmed', 'completed', 'cancelled'] as const;
export const quoteStageSchema = z.enum(QUOTE_STAGES);
export type QuoteStage = z.infer<typeof quoteStageSchema>;

export const discountTypeSchema = z.enum(['fixed', 'percent']);
export type DiscountType = z.infer<typeof discountTypeSchema>;

// Pipeline transition matrix (mach-bar-flows.md §3.2), shared FE/BE so the drag affordance
// and the server-side check never drift. `confirmed → completed` ("realizar") is only
// reachable once `events.markCompleted` lands (Fase 5) — the matrix already carries it so
// Fase 5 doesn't have to touch this file, it just adds the router procedure.
export const QUOTE_STAGE_TRANSITIONS: Record<QuoteStage, QuoteStage[]> = {
  new: ['quoted', 'cancelled'],
  quoted: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['quoted'],
};

export function canTransition(from: QuoteStage, to: QuoteStage): boolean {
  return QUOTE_STAGE_TRANSITIONS[from].includes(to);
}

// ── quote lines ──
export const quoteLineSelectionSchema = z.object({
  optionGroupId: z.uuid(),
  optionIds: z.array(z.uuid()),
});
export type QuoteLineSelectionInput = z.infer<typeof quoteLineSelectionSchema>;

export const quoteLineInputSchema = z.object({
  productId: z.uuid(),
  numPersons: z.number().int().min(1, 'quotes.validation.numPersonsInvalid'),
  subtotal: z.number().int().min(0, 'quotes.validation.subtotalInvalid'),
  selections: z.array(quoteLineSelectionSchema).default([]),
});
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;

// ── quote ──
const blankToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);

const quoteMutationFields = {
  clientId: z.uuid(),
  eventTypeId: z.preprocess(blankToUndefined, z.uuid().optional()),
  eventDate: z.preprocess(blankToUndefined, z.iso.date().optional()),
  eventTime: optionalText(20),
  state: z.preprocess(blankToUndefined, stateSchema.optional()),
  address: optionalText(240),
  notes: optionalText(2000),
  discountType: z.preprocess(blankToUndefined, discountTypeSchema.optional()),
  discountValue: z.number().min(0).optional(),
  depositRate: z.number().min(0).max(1).optional(),
  lines: z.array(quoteLineInputSchema).default([]),
} as const;

export const createQuoteSchema = z.object(quoteMutationFields);
export const updateQuoteSchema = z.object(quoteMutationFields);

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

export const updateQuoteStageSchema = z.object({
  id: z.uuid(),
  stage: quoteStageSchema,
});
export type UpdateQuoteStageInput = z.infer<typeof updateQuoteStageSchema>;

// ── list / board queries ──
export const quotesListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['number', 'eventDate', 'total', 'stage', 'createdAt']).default('createdAt'),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().optional(),
  stage: quoteStageSchema.optional(),
  state: stateSchema.optional(),
  clientId: z.uuid().optional(),
});
export type QuotesListQuery = z.infer<typeof quotesListQuerySchema>;

export const quotesBoardQuerySchema = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().optional(),
});
export type QuotesBoardQuery = z.infer<typeof quotesBoardQuerySchema>;

// ── price cascade — mach-bar-domain.md §7, shared so preview (FE) = saved (BE) = PDF ──
export interface QuoteTotalsInput {
  lines: { subtotal: number }[];
  discountType?: DiscountType | null;
  discountValue?: number | null;
  taxRate: number;
  depositRate: number;
}

export interface QuoteTotals {
  subtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  depositRate: number;
  depositAmount: number;
}

export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const subtotal = input.lines.reduce((sum, line) => sum + line.subtotal, 0);

  const discountAmount =
    input.discountType === 'fixed'
      ? Math.round(input.discountValue ?? 0)
      : input.discountType === 'percent'
        ? Math.round(subtotal * (input.discountValue ?? 0))
        : 0;

  const base = subtotal - discountAmount;
  const taxAmount = Math.round(base * input.taxRate);
  const total = base + taxAmount;
  const depositAmount = Math.round(total * input.depositRate);

  return {
    subtotal,
    discountAmount,
    taxRate: input.taxRate,
    taxAmount,
    total,
    depositRate: input.depositRate,
    depositAmount,
  };
}
