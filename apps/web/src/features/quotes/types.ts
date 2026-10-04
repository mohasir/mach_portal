import type { QUOTE_STAGE, QuoteStageId, QuotesFilters } from '@repo/schemas';
import type { RouterOutputs } from '@/lib/trpc/types';

export type Quote = RouterOutputs['quotes']['list']['items'][number];
export type QuoteDetail = RouterOutputs['quotes']['getById'];
export type QuoteBoard = RouterOutputs['quotes']['board'];
export type QuoteCard = QuoteBoard[typeof QUOTE_STAGE.PENDING][number];
/** A pipeline column: one per stage, plus the archived one when archived quotes are included. */
export type PipelineColumnKey = QuoteStageId | 'archived';

/** Filter bar state shared by the table and pipeline views. */
export type QuotesPageFilters = QuotesFilters;
