import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { optionalText } from './fields';
import { createClientSchema } from './clients';
import { quoteChargesInputSchema, type ChargeKind } from './charges';
import { LOCATION_LOCALITY_MAX, LOCATION_REGION_MAX } from './location';

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
  uomId: z.uuid().optional(),
  quantity: z.number().int().min(1, 'quotes:validation.quantityInvalid'),
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
  // The country is never accepted from the client: the API takes it from the location settings.
  region: optionalText(LOCATION_REGION_MAX),
  locality: optionalText(LOCATION_LOCALITY_MAX),
  address: optionalText(240),
  notes: optionalText(2000),
  clientNotes: optionalText(2000),
  discountType: z.preprocess(blankToUndefined, discountTypeSchema.optional()),
  discountValue: z.number().min(0).optional(),
  depositRate: z.number().min(0).max(1).optional(),
  lines: z.array(quoteLineInputSchema).default([]),
  // Omitted, the quote is left without charges (see the quotes service for the add-on rules).
  charges: quoteChargesInputSchema.optional(),
  selectOptionsAtQuote: z.boolean().default(false),
} as const;

const clientXor = (data: { clientId?: string; newClient?: unknown }) =>
  !!data.clientId !== !!data.newClient;

export const createQuoteSchema = z
  .object({ ...quoteMutationFields, isDraft: z.boolean() })
  .refine(clientXor, { message: 'quotes:validation.clientRequired', path: ['clientId'] });
export const updateQuoteSchema = z
  .object({ ...quoteMutationFields, isDraft: z.boolean() })
  .refine(clientXor, { message: 'quotes:validation.clientRequired', path: ['clientId'] });

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;

export const updateQuoteStageSchema = z.object({
  id: z.uuid(),
  stageId: quoteStageIdSchema,
});
export type UpdateQuoteStageInput = z.infer<typeof updateQuoteStageSchema>;

// `assignedToId: null` un-assigns the quote — kept apart from `updateQuoteSchema` since
// only an unrestricted (scope 'all') role may reassign, never the owner/assignee itself.
export const assignQuoteSchema = z.object({
  id: z.uuid(),
  assignedToId: z.string().nullable(),
});
export type AssignQuoteInput = z.infer<typeof assignQuoteSchema>;

// Advisory only — the business allows two quotes/events at the same date and time, so this
// is never enforced server-side on create/update, just surfaced to the builder as a heads-up.
export const checkQuoteAvailabilitySchema = z.object({
  eventDate: z.iso.date(),
  eventTime: z.string().min(1),
  excludeQuoteId: z.uuid().optional(),
});
export type CheckQuoteAvailabilityQuery = z.infer<typeof checkQuoteAvailabilitySchema>;

// ── list / board queries ──
// Filters that mean the same thing on the list and the pipeline board, so the quotes page can
// share one filter bar between both views. Each list matches any of its values.
export const quotesFiltersSchema = listQuerySchema.pick({ search: true }).extend({
  regions: z.array(z.string().max(LOCATION_REGION_MAX)).max(100).optional(),
  assignedToIds: z.array(z.string()).optional(),
  eventTypeIds: z.array(z.uuid()).optional(),
  /** true: drafts only; omitted: drafts and finished quotes alike. */
  isDraft: z.boolean().optional(),
  /** true: only stale quotes — open with the event date past, or sent with validity expired. */
  stale: z.boolean().optional(),
  /** true: only archived quotes; only applies alongside `includeArchived`. */
  archived: z.boolean().optional(),
});
export type QuotesFilters = z.infer<typeof quotesFiltersSchema>;

// What the list/board include at all (per-user view preferences), as opposed to the filter bar.
export const quotesViewOptionsSchema = z.object({
  /** Leave stale quotes out — unless searching, where one specific quote is being looked for. */
  hideStale: z.boolean().optional(),
  /** Also return archived quotes. Needs QUOTE/VIEW_ARCHIVED; ignored server-side otherwise. */
  includeArchived: z.boolean().optional(),
});
export type QuotesViewOptions = z.infer<typeof quotesViewOptionsSchema>;

export const quotesListQuerySchema = listQuerySchema.extend({
  ...quotesFiltersSchema.shape,
  ...quotesViewOptionsSchema.shape,
  sortBy: z.enum(['number', 'eventDate', 'total', 'stage', 'createdAt']).default('createdAt'),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().optional(),
  stageId: quoteStageIdSchema.optional(),
  clientId: z.uuid().optional(),
});
export type QuotesListQuery = z.infer<typeof quotesListQuerySchema>;

export const quotesBoardQuerySchema = quotesFiltersSchema.extend(quotesViewOptionsSchema.shape);
export type QuotesBoardQuery = z.infer<typeof quotesBoardQuerySchema>;

// ── price cascade — mach-bar-domain.md §7, shared so preview (FE) = saved (BE) = PDF ──

/**
 * Splits a non-negative integer `amount` in proportion to non-negative integer `weights` so the
 * parts add up to it exactly: each part takes the floor of its share and the leftover units go to
 * the largest remainders, the earlier entry on a tie. The arithmetic runs on BigInt because
 * amount × weight easily passes 2^53 on large quotes, where floating point loses the exact
 * remainders (and equal shares then tie exactly, as they do in SQL `numeric`). Throws a RangeError
 * for an amount or weight that is not a safe integer.
 */
export function allocateProportionally(amount: number, weights: readonly number[]): number[] {
  for (const value of [amount, ...weights]) {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(`allocateProportionally: ${value} is not a safe integer`);
    }
  }
  const totalWeight = weights.reduce((sum, w) => sum + BigInt(w), 0n);
  if (amount <= 0 || totalWeight <= 0n) return weights.map(() => 0);
  const big = BigInt(amount);
  const scaled = weights.map((w) => big * BigInt(w));
  const remainders = scaled.map((value) => value % totalWeight);
  const parts = scaled.map((value, index) => (value - remainders[index]!) / totalWeight);
  const order = remainders
    .map((remainder, index) => ({ index, remainder }))
    .sort((x, y) =>
      x.remainder === y.remainder ? x.index - y.index : x.remainder > y.remainder ? -1 : 1,
    );
  let left = big - parts.reduce((sum, p) => sum + p, 0n);
  for (const { index } of order) {
    if (left <= 0n) break;
    parts[index]! += 1n;
    left -= 1n;
  }
  return parts.map(Number);
}

export interface QuoteTotalsLine {
  subtotal: number;
  /** The rate frozen on the line; 0 for an exempt product. */
  taxRate: number;
}

export interface QuoteTotalsInput {
  lines: QuoteTotalsLine[];
  discountType?: DiscountType | null;
  discountValue?: number | null;
  /** Untaxed charges on top of the total with tax: cents when fixed, a rate when percent. */
  charges?: readonly QuoteTotalsCharge[];
  depositRate: number;
}

export interface QuoteTotalsCharge {
  kind: ChargeKind;
  value: number;
}

export interface QuoteLineTotals {
  /** The part of the quote discount this line carries. */
  discountShare: number;
  taxAmount: number;
}

export interface QuoteTaxBreakdownItem {
  taxRate: number;
  /** Net of the lines at this rate, after their discount share. */
  base: number;
  taxAmount: number;
}

export interface QuoteTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  depositRate: number;
  depositAmount: number;
  /** One entry per input line, in the same order. */
  lines: QuoteLineTotals[];
  /** One entry per distinct rate, lowest rate first. */
  taxBreakdown: QuoteTaxBreakdownItem[];
  /** One entry per input charge, in the same order. */
  charges: { amount: number }[];
}

const quoteDiscount = (input: QuoteTotalsInput, subtotal: number) => {
  const raw =
    input.discountType === 'fixed'
      ? Math.round(input.discountValue ?? 0)
      : input.discountType === 'percent'
        ? Math.round(subtotal * (input.discountValue ?? 0))
        : 0;
  return Math.min(Math.max(raw, 0), subtotal);
};

// Tax is rounded once per rate over the lines that share it, then split back over those lines, so
// a quote at a single rate is taxed exactly as round(base × rate) whatever its number of lines.
export function computeQuoteTotals(input: QuoteTotalsInput): QuoteTotals {
  const subtotal = input.lines.reduce((sum, line) => sum + line.subtotal, 0);
  const discountAmount = quoteDiscount(input, subtotal);
  const discountShares = allocateProportionally(
    discountAmount,
    input.lines.map((l) => l.subtotal),
  );
  const bases = input.lines.map((line, i) => line.subtotal - discountShares[i]!);

  const lineTaxes = input.lines.map(() => 0);
  const rates = [...new Set(input.lines.map((l) => l.taxRate))].sort((x, y) => x - y);
  const taxBreakdown = rates.map((taxRate) => {
    const indexes = input.lines.flatMap((l, i) => (l.taxRate === taxRate ? [i] : []));
    const base = indexes.reduce((sum, i) => sum + bases[i]!, 0);
    const taxAmount = Math.round(base * taxRate);
    const parts = allocateProportionally(
      taxAmount,
      indexes.map((i) => bases[i]!),
    );
    indexes.forEach((lineIndex, k) => (lineTaxes[lineIndex] = parts[k]!));
    return { taxRate, base, taxAmount };
  });
  const taxAmount = taxBreakdown.reduce((sum, b) => sum + b.taxAmount, 0);

  // Charges are not taxed, and every percent charge is taken on the same total with tax, so
  // neither fixed charges nor other percent charges are part of its base.
  const taxedTotal = subtotal - discountAmount + taxAmount;
  const charges = (input.charges ?? []).map((charge) => ({
    amount:
      charge.kind === 'percent' ? Math.round(taxedTotal * charge.value) : Math.round(charge.value),
  }));
  const total = taxedTotal + charges.reduce((sum, c) => sum + c.amount, 0);
  const depositAmount = Math.round(total * input.depositRate);

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
    depositRate: input.depositRate,
    depositAmount,
    lines: input.lines.map((_, i) => ({
      discountShare: discountShares[i]!,
      taxAmount: lineTaxes[i]!,
    })),
    taxBreakdown,
    charges,
  };
}

export interface SavedTaxBreakdownItem {
  /** Null for stored quote tax that no line carries (see summarizeLineTaxes). */
  taxRate: number | null;
  taxAmount: number;
}

/**
 * Tax of saved lines grouped by their frozen rate, lowest rate first. Quotes saved before taxes
 * moved to the lines may hold tax that none of their lines carries (a quote without lines, taxed on
 * its long distance amount); that difference with the stored `quoteTaxAmount` is kept as a last
 * entry without rate, so the breakdown still adds up to the stored tax.
 */
export function summarizeLineTaxes(
  lines: readonly { taxRate: number; taxAmount: number }[],
  quoteTaxAmount: number,
): SavedTaxBreakdownItem[] {
  const byRate = new Map<number, number>();
  for (const line of lines) {
    byRate.set(line.taxRate, (byRate.get(line.taxRate) ?? 0) + line.taxAmount);
  }
  const items: SavedTaxBreakdownItem[] = [...byRate]
    .sort(([x], [y]) => x - y)
    .map(([taxRate, taxAmount]) => ({ taxRate, taxAmount }));
  const unassigned = quoteTaxAmount - items.reduce((sum, item) => sum + item.taxAmount, 0);
  if (unassigned !== 0) items.push({ taxRate: null, taxAmount: unassigned });
  return items;
}
