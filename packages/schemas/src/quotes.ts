import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { stateSchema } from './enums';
import { optionalText } from './fields';
import { createClientSchema } from './clients';

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Stages are a fixed set backed by a DB table (quote_stages) so label/color are admin-editable
// (mach-bar-domain.md D18) — but the ids themselves are hardcoded here and never created/removed,
// so business logic (transitions, editable-stage checks) can key off them safely.
export const QUOTE_STAGE = {
  PENDING: 1,
  QUOTED: 2,
  CONFIRMED: 3,
  CANCELLED: 4,
} as const;
export const QUOTE_STAGE_IDS = Object.values(QUOTE_STAGE);
export type QuoteStageId = (typeof QUOTE_STAGE)[keyof typeof QUOTE_STAGE];

export const quoteStageIdSchema = z.union([
  z.literal(QUOTE_STAGE.PENDING),
  z.literal(QUOTE_STAGE.QUOTED),
  z.literal(QUOTE_STAGE.CONFIRMED),
  z.literal(QUOTE_STAGE.CANCELLED),
]);

// Free hex color (admin picks it via a ColorPicker, presets = AntD's Tag palette) — not a
// hardcoded component color, this is admin-authored data (mach-bar-domain.md D18).
export const quoteStageColorSchema = z
  .string()
  .regex(HEX_COLOR_RE, 'config:validation.quoteStagesColorInvalid');
export type QuoteStageColor = z.infer<typeof quoteStageColorSchema>;

export const quoteStageCatalogItemSchema = z.object({
  id: quoteStageIdSchema,
  label: z.string().min(1).max(40),
  color: quoteStageColorSchema,
  description: optionalText(200),
});
export type QuoteStageCatalogItem = z.infer<typeof quoteStageCatalogItemSchema>;

export const updateQuoteStagesSchema = z
  .array(quoteStageCatalogItemSchema)
  .length(QUOTE_STAGE_IDS.length)
  .refine((rows) => QUOTE_STAGE_IDS.every((id) => rows.some((r) => r.id === id)), {
    message: 'config:validation.quoteStagesInvalid',
  });
export type UpdateQuoteStagesInput = z.infer<typeof updateQuoteStagesSchema>;

export const discountTypeSchema = z.enum(['fixed', 'percent']);
export type DiscountType = z.infer<typeof discountTypeSchema>;

// Pipeline transition matrix (mach-bar-flows.md §3.2), shared FE/BE so the drag affordance
// and the server-side check never drift. `confirmed` is a terminal success state for the quote —
// "realizar el evento" lives on `events` (Fase 5), not as a quote stage.
export const QUOTE_STAGE_TRANSITIONS: Record<QuoteStageId, QuoteStageId[]> = {
  [QUOTE_STAGE.PENDING]: [QUOTE_STAGE.QUOTED, QUOTE_STAGE.CANCELLED],
  [QUOTE_STAGE.QUOTED]: [QUOTE_STAGE.CONFIRMED, QUOTE_STAGE.CANCELLED],
  [QUOTE_STAGE.CONFIRMED]: [QUOTE_STAGE.CANCELLED],
  [QUOTE_STAGE.CANCELLED]: [QUOTE_STAGE.QUOTED],
};

export function canTransition(from: QuoteStageId, to: QuoteStageId): boolean {
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
  numPersons: z.number().int().min(1, 'quotes:validation.numPersonsInvalid'),
  subtotal: z.number().int().min(0, 'quotes:validation.subtotalInvalid'),
  selections: z.array(quoteLineSelectionSchema).default([]),
});
export type QuoteLineInput = z.infer<typeof quoteLineInputSchema>;

// ── quote ──
const blankToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);

export const quoteNewClientSchema = createClientSchema.pick({
  name: true,
  phone: true,
  email: true,
});

const quoteMutationFields = {
  clientId: z.preprocess(blankToUndefined, z.uuid().optional()),
  newClient: quoteNewClientSchema.optional(),
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

const clientXor = (data: { clientId?: string; newClient?: unknown }) =>
  !!data.clientId !== !!data.newClient;

export const createQuoteSchema = z
  .object({ ...quoteMutationFields, isDraft: z.boolean() })
  .refine(clientXor, { message: 'quotes:validation.clientRequired', path: ['clientId'] });
export const updateQuoteSchema = z
  .object(quoteMutationFields)
  .refine(clientXor, { message: 'quotes:validation.clientRequired', path: ['clientId'] });

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

export const updateQuoteStageSchema = z.object({
  id: z.uuid(),
  stageId: quoteStageIdSchema,
});
export type UpdateQuoteStageInput = z.infer<typeof updateQuoteStageSchema>;

// ── list / board queries ──
export const quotesListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['number', 'eventDate', 'total', 'stage', 'createdAt']).default('createdAt'),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().optional(),
  stageId: quoteStageIdSchema.optional(),
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
