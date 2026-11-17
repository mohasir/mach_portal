import { createStore } from 'zustand';
import type { DiscountType, StateValue } from '@repo/schemas';
import type { QuantityUnit } from '@/lib/format/quantity';
import type { BuilderCharge } from './chargeHelpers';

export interface LineDraft {
  key: string;
  productId: string;
  quantity: number;
  subtotal: number;
  selections: Record<string, string[]>;
  /** Unit frozen on a line loaded from a saved quote; absent on lines added from the catalog. */
  uomId?: string;
  unit?: QuantityUnit;
  /** Rate frozen on a line loaded from a saved quote; absent on lines added from the catalog. */
  taxRate?: number;
}

export interface NewClientDraft {
  name: string;
  phone: string;
  email: string;
}

export interface QuoteBuilderState {
  clientId: string | null;
  clientName: string | null; // display-only, not sent to the server
  newClient: NewClientDraft | null;
  eventTypeId: string | null;
  eventDate: string | null;
  eventTime: string | null;
  state: StateValue | null;
  address: string;
  city: string;
  notes: string;
  clientNotes: string;
  lines: LineDraft[];
  discountType: DiscountType | null;
  discountValue: number | null;
  charges: BuilderCharge[];
  depositRate: number;
  selectOptionsAtQuote: boolean;
}

export function emptyBuilderState(
  depositRate: number,
  initialClient?: { clientId: string; clientName: string },
  initialEventDate?: string,
): QuoteBuilderState {
  return {
    clientId: initialClient?.clientId ?? null,
    clientName: initialClient?.clientName ?? null,
    newClient: null,
    eventTypeId: null,
    eventDate: initialEventDate ?? null,
    eventTime: null,
    state: null,
    address: '',
    city: '',
    notes: '',
    clientNotes: '',
    lines: [],
    discountType: null,
    discountValue: null,
    charges: [],
    depositRate,
    selectOptionsAtQuote: false,
  };
}

export interface QuoteBuilderStore {
  state: QuoteBuilderState;
  initialState: QuoteBuilderState;
  setFields: (payload: Partial<QuoteBuilderState>) => void;
  addLine: (line: LineDraft) => void;
  removeLine: (key: string) => void;
  updateLine: (
    key: string,
    payload: Partial<Pick<LineDraft, 'quantity' | 'subtotal' | 'uomId' | 'unit'>>,
  ) => void;
  setSelection: (key: string, optionGroupId: string, optionIds: string[]) => void;
  reset: (state: QuoteBuilderState) => void;
}

export function createQuoteBuilderStore(initialState: QuoteBuilderState) {
  return createStore<QuoteBuilderStore>((set) => ({
    state: initialState,
    initialState,
    setFields: (payload) => set((s) => ({ state: { ...s.state, ...payload } })),
    addLine: (line) => set((s) => ({ state: { ...s.state, lines: [...s.state.lines, line] } })),
    removeLine: (key) =>
      set((s) => ({
        state: { ...s.state, lines: s.state.lines.filter((l) => l.key !== key) },
      })),
    updateLine: (key, payload) =>
      set((s) => ({
        state: {
          ...s.state,
          lines: s.state.lines.map((l) => (l.key === key ? { ...l, ...payload } : l)),
        },
      })),
    setSelection: (key, optionGroupId, optionIds) =>
      set((s) => ({
        state: {
          ...s.state,
          lines: s.state.lines.map((l) =>
            l.key === key
              ? { ...l, selections: { ...l.selections, [optionGroupId]: optionIds } }
              : l,
          ),
        },
      })),
    reset: (nextState) => set({ state: nextState }),
  }));
}

export type QuoteBuilderStoreApi = ReturnType<typeof createQuoteBuilderStore>;
