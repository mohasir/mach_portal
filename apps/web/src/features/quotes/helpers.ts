import type { CreateQuoteInput, QuoteLineInput } from '@repo/schemas';
import type { LineDraft, QuoteBuilderState } from './hooks/useQuoteBuilder';
import type { QuoteDetail } from './types';

export const nextLineKey = (): string => crypto.randomUUID();

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

export function toCreateInput(state: QuoteBuilderState): CreateQuoteInput {
  return {
    clientId: state.clientId!,
    eventTypeId: state.eventTypeId ?? undefined,
    eventDate: state.eventDate ?? undefined,
    eventTime: state.eventTime ?? undefined,
    state: state.state ?? undefined,
    address: state.address.trim() || undefined,
    notes: state.notes.trim() || undefined,
    discountType: state.discountType ?? undefined,
    discountValue: state.discountValue ?? undefined,
    depositRate: state.depositRate,
    lines: toQuoteLineInputs(state.lines),
  };
}

export function toBuilderState(detail: QuoteDetail): QuoteBuilderState {
  return {
    clientId: detail.clientId,
    clientName: detail.clientName,
    eventTypeId: detail.eventTypeId,
    eventDate: detail.eventDate,
    eventTime: detail.eventTime,
    state: detail.state,
    address: detail.address ?? '',
    notes: detail.notes ?? '',
    discountType: detail.discountType,
    discountValue: detail.discountValue,
    depositRate: detail.depositRate,
    lines: detail.lines.map((line) => ({
      key: nextLineKey(),
      productId: line.productId,
      numPersons: line.numPersons,
      subtotal: line.subtotal,
      selections: Object.fromEntries(line.selections.map((s) => [s.optionGroupId, s.optionIds])),
    })),
  };
}

/** Enables "Enviar" — "Guardar borrador" only needs a client. */
export function isQuoteReadyToSend(state: QuoteBuilderState): boolean {
  return (
    !!state.clientId && !!state.state && state.address.trim().length > 0 && state.lines.length > 0
  );
}
