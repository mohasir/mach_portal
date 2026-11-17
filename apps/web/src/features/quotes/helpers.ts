import {
  QUOTE_STAGE,
  type CreateQuoteInput,
  type QuoteLineInput,
  type QuotesFilters,
} from '@repo/schemas';
import {
  isLocationComplete,
  isPlaceStale,
  type LocationSettings,
} from '@/components/shared/LocationFields/helpers';
import { isPastDate, type DateInput } from '@/lib/date';
import { chargesToSend } from './chargeHelpers';
import type { LineDraft, QuoteBuilderState } from './hooks/useQuoteBuilder';
import type { QuoteDetail } from './types';

interface QuoteTimeline {
  stageId: number;
  eventDate?: DateInput | null;
  validUntil?: DateInput | null;
}

/** Sent, but the quoted prices are no longer valid. */
export const isQuoteExpired = (quote: QuoteTimeline) =>
  quote.stageId === QUOTE_STAGE.QUOTED && isPastDate(quote.validUntil);

/** Still open (pending/sent) although the event date already went by. */
export const isQuotePastDue = (quote: QuoteTimeline) =>
  (quote.stageId === QUOTE_STAGE.PENDING || quote.stageId === QUOTE_STAGE.QUOTED) &&
  isPastDate(quote.eventDate);

/** Filter-bar criteria in use; search is left out since it has its own field. */
export const countActiveFilters = ({
  regions,
  assignedToIds,
  eventTypeIds,
  isDraft,
  stale,
  archived,
}: QuotesFilters) =>
  [regions?.length, assignedToIds?.length, eventTypeIds?.length, isDraft, stale, archived].filter(
    Boolean,
  ).length;

export const nextLineKey = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function toQuoteLineInputs(lines: LineDraft[]): QuoteLineInput[] {
  return lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    subtotal: line.subtotal,
    ...(line.uomId ? { uomId: line.uomId } : {}),
    selections: Object.entries(line.selections)
      .filter(([, optionIds]) => optionIds.length > 0)
      .map(([optionGroupId, optionIds]) => ({ optionGroupId, optionIds })),
  }));
}

// A place saved under another country is not resent: the API would validate it against the
// current country, and a code shared between countries would silently change meaning.
export function toCreateInput(
  state: QuoteBuilderState,
  isDraft: boolean,
  settings?: LocationSettings | null,
): CreateQuoteInput {
  const stale = isPlaceStale(settings, state.country);
  return {
    isDraft,
    clientId: state.newClient ? undefined : (state.clientId ?? undefined),
    newClient: state.newClient
      ? {
          name: state.newClient.name.trim(),
          phone: state.newClient.phone.trim() || undefined,
          email: state.newClient.email.trim() || undefined,
        }
      : undefined,
    eventTypeId: state.eventTypeId ?? undefined,
    eventDate: state.eventDate ?? undefined,
    eventTime: state.eventTime ?? undefined,
    region: (!stale && state.region) || undefined,
    locality: (!stale && state.locality) || undefined,
    address: state.address.trim() || undefined,
    notes: state.notes.trim() || undefined,
    clientNotes: state.clientNotes.trim() || undefined,
    discountType: state.discountType ?? undefined,
    discountValue: state.discountValue ?? undefined,
    charges: chargesToSend(state.charges),
    depositRate: state.depositRate,
    lines: toQuoteLineInputs(state.lines),
    selectOptionsAtQuote: state.selectOptionsAtQuote,
  };
}

export function toBuilderState(detail: QuoteDetail): QuoteBuilderState {
  return {
    clientId: detail.clientId,
    clientName: detail.clientName,
    newClient: null,
    eventTypeId: detail.eventTypeId,
    eventDate: detail.eventDate,
    eventTime: detail.eventTime,
    country: detail.country,
    region: detail.region,
    locality: detail.locality,
    address: detail.address ?? '',
    notes: detail.notes ?? '',
    clientNotes: detail.clientNotes ?? '',
    discountType: detail.discountType,
    discountValue: detail.discountValue,
    charges: detail.charges.map((charge) => ({
      chargeTypeId: charge.chargeTypeId,
      name: charge.name,
      kind: charge.kind,
      value: charge.value,
    })),
    depositRate: detail.depositRate,
    selectOptionsAtQuote: detail.selectOptionsAtQuote,
    lines: detail.lines.map((line) => ({
      key: nextLineKey(),
      productId: line.productId,
      quantity: line.quantity,
      subtotal: line.subtotal,
      uomId: line.uomId,
      unit: line.unit,
      taxRate: line.taxRate,
      selections: Object.fromEntries(line.selections.map((s) => [s.optionGroupId, s.optionIds])),
    })),
  };
}

// The PDF storage key is derived from the quote number, so the URL is identical across
// regenerations — without a cache-busting param the browser reuses its cached response
// instead of fetching the newly regenerated file.
export function withPdfCacheBuster(
  pdfUrl: string,
  pdfGeneratedAt: string | Date | null | undefined,
): string {
  if (!pdfGeneratedAt) return pdfUrl;
  const separator = pdfUrl.includes('?') ? '&' : '?';
  return `${pdfUrl}${separator}v=${new Date(pdfGeneratedAt).getTime()}`;
}

export function openQuotePdf(
  pdfUrl: string,
  pdfGeneratedAt: string | Date | null | undefined,
): void {
  window.open(withPdfCacheBuster(pdfUrl, pdfGeneratedAt), '_blank');
}

export function hasClient(state: QuoteBuilderState): boolean {
  return !!state.clientId || !!state.newClient?.name.trim();
}

export function hasBuilderChanges(
  state: QuoteBuilderState,
  initialState: QuoteBuilderState,
): boolean {
  return JSON.stringify(state) !== JSON.stringify(initialState);
}

/**
 * Enables "Enviar" — "Guardar borrador" only needs a client. Mirrors the API gate: lines,
 * and with the location function on every level up to its depth plus the address when asked.
 * Without the settings loaded the place cannot be judged, so it is not ready.
 */
export function isQuoteReadyToSend(
  state: QuoteBuilderState,
  settings: LocationSettings | null | undefined,
): boolean {
  return (
    hasClient(state) &&
    state.lines.length > 0 &&
    !!settings &&
    !isPlaceStale(settings, state.country) &&
    isLocationComplete(settings, state)
  );
}
