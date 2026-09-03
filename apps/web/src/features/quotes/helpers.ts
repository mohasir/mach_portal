import type { LucideIcon } from 'lucide-react';
import type { CreateQuoteInput, QuoteLineInput } from '@repo/schemas';
import { DEFAULT_STATION_ICON, STATION_ICON_RULES } from './constants';
import type { LineDraft, QuoteBuilderState } from './hooks/useQuoteBuilder';
import type { QuoteDetail } from './types';

export const nextLineKey = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function getStationIcon(stationName: string): LucideIcon {
  const lower = stationName.toLowerCase();
  return (
    STATION_ICON_RULES.find((rule) => rule.keywords.some((keyword) => lower.includes(keyword)))
      ?.icon ?? DEFAULT_STATION_ICON
  );
}

export function toQuoteLineInputs(lines: LineDraft[]): QuoteLineInput[] {
  return lines.map((line) => ({
    productId: line.productId,
    numPersons: line.numPersons,
    subtotal: line.subtotal,
    selections: Object.entries(line.selections)
      .filter(([, optionIds]) => optionIds.length > 0)
      .map(([optionGroupId, optionIds]) => ({ optionGroupId, optionIds })),
  }));
}

export function toCreateInput(state: QuoteBuilderState, isDraft: boolean): CreateQuoteInput {
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
    state: state.state ?? undefined,
    address: state.address.trim() || undefined,
    city: state.city.trim() || undefined,
    notes: state.notes.trim() || undefined,
    clientNotes: state.clientNotes.trim() || undefined,
    discountType: state.discountType ?? undefined,
    discountValue: state.discountValue ?? undefined,
    longDistanceAmount: state.longDistanceAmount,
    applyCardSurcharge: state.applyCardSurcharge,
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
    state: detail.state,
    address: detail.address ?? '',
    city: detail.city ?? '',
    notes: detail.notes ?? '',
    clientNotes: detail.clientNotes ?? '',
    discountType: detail.discountType,
    discountValue: detail.discountValue,
    longDistanceAmount: detail.longDistanceAmount,
    applyCardSurcharge: detail.applyCardSurcharge,
    depositRate: detail.depositRate,
    selectOptionsAtQuote: detail.selectOptionsAtQuote,
    lines: detail.lines.map((line) => ({
      key: nextLineKey(),
      productId: line.productId,
      numPersons: line.numPersons,
      subtotal: line.subtotal,
      selections: Object.fromEntries(line.selections.map((s) => [s.optionGroupId, s.optionIds])),
    })),
  };
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

/** Enables "Enviar" — "Guardar borrador" only needs a client. */
export function isQuoteReadyToSend(state: QuoteBuilderState): boolean {
  return (
    hasClient(state) &&
    !!state.state &&
    state.address.trim().length > 0 &&
    state.city.trim().length > 0 &&
    state.lines.length > 0
  );
}
