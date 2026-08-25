'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import {
  createQuoteBuilderStore,
  type QuoteBuilderState,
  type QuoteBuilderStoreApi,
} from '../quotes.store';

export { emptyBuilderState } from '../quotes.store';
export type { LineDraft, NewClientDraft, QuoteBuilderState } from '../quotes.store';

const QuoteBuilderContext = createContext<QuoteBuilderStoreApi | null>(null);

export function QuoteBuilderProvider({
  initialState,
  children,
}: {
  initialState: QuoteBuilderState;
  children: ReactNode;
}) {
  const [store] = useState(() => createQuoteBuilderStore(initialState));
  return <QuoteBuilderContext.Provider value={store}>{children}</QuoteBuilderContext.Provider>;
}

export function useQuoteBuilder() {
  const store = useContext(QuoteBuilderContext);
  if (!store) throw new Error('useQuoteBuilder must be used within a QuoteBuilderProvider');
  return useStore(store, (s) => s);
}
