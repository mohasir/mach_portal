import type { RouterOutputs } from '@/lib/trpc/types';

export type Quote = RouterOutputs['quotes']['list']['items'][number];
export type QuoteDetail = RouterOutputs['quotes']['getById'];
export type QuoteBoard = RouterOutputs['quotes']['board'];
export type QuoteCard = QuoteBoard['new'][number];
