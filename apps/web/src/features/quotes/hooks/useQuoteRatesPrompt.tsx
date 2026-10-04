'use client';
import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, type QuoteRateDrift, type QuoteRates } from '@repo/schemas';
import { useConfirmModal } from '@/components/shared/ConfirmDialogs';
import { useCan } from '@/lib/auth/useCan';
import { useApiError } from '@/lib/error/useApiError';
import { useTRPC } from '@/lib/trpc/client';

/** Where the question comes up: opening the quote, or moving it out of Pending. */
export type QuoteRatesPromptMode = 'open' | 'move';

const RATE_KEYS: (keyof QuoteRates)[] = ['taxRate', 'cardSurchargeRate'];

const formatRate = (rate: number) => `${Math.round(rate * 100000) / 1000}%`;

function RateDriftContent({ drift }: { drift: QuoteRateDrift }) {
  const { t } = useTranslation('quotes');
  return (
    <span className="flex flex-col gap-2">
      <span>{t('rateDrift.content')}</span>
      {RATE_KEYS.filter((key) => drift.saved[key] !== drift.current[key]).map((key) => (
        <span key={key} className="font-medium text-foreground">
          {t(`rateDrift.${key}`)}: {formatRate(drift.saved[key])} → {formatRate(drift.current[key])}
        </span>
      ))}
      <span>{t('rateDrift.totalWarning')}</span>
    </span>
  );
}

/**
 * The one place that asks whether a pending quote should take the current config rates (tax by
 * state, card surcharge) after they changed. `promptRates` resolves `true` once the user has
 * answered (or right away when there's nothing to ask) and `false` if saving the answer failed,
 * so a caller can chain the action it was about to do.
 */
export function useQuoteRatesPrompt() {
  const { t } = useTranslation('quotes');
  const trpc = useTRPC();
  const qc = useQueryClient();
  const can = useCan();
  const onError = useApiError();
  const [confirm, ratesContextHolder] = useConfirmModal();
  const resolveDrift = useMutation(
    trpc.quotes.resolveRateDrift.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.quotes.pathFilter()),
      onError,
    }),
  );

  const promptRates = async (quoteId: string, mode: QuoteRatesPromptMode) => {
    if (!can({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] })) return true;

    let drift: QuoteRateDrift | null;
    try {
      drift = await qc.fetchQuery({
        ...trpc.quotes.rateDrift.queryOptions({ id: quoteId }),
        staleTime: 0,
      });
    } catch {
      // Out of the caller's scope: nothing it could reprice, so nothing to ask.
      return true;
    }
    if (!drift) return true;
    const changes = drift;

    return new Promise<boolean>((done) => {
      const answer = (accept: boolean) =>
        resolveDrift
          .mutateAsync({ id: quoteId, accept })
          .then(() => done(true))
          .catch(() => done(false));
      confirm({
        type: 'warning',
        dismissible: false,
        title: t('rateDrift.title'),
        content: <RateDriftContent drift={changes} />,
        okText: t(`rateDrift.${mode}.accept`),
        cancelText: t(`rateDrift.${mode}.keep`),
        onOk: () => void answer(true),
        onCancel: () => void answer(false),
      });
    });
  };

  return { promptRates, ratesContextHolder };
}

/** Asks once per quote when it's opened (detail or builder) while still pending. */
export function useQuoteRatesCheckOnOpen(
  quote: { id: string; stageId: number; isArchived: boolean } | undefined,
) {
  const { promptRates, ratesContextHolder } = useQuoteRatesPrompt();
  const checkedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!quote || quote.stageId !== QUOTE_STAGE.PENDING || quote.isArchived) return;
    if (checkedFor.current === quote.id) return;
    checkedFor.current = quote.id;
    void promptRates(quote.id, 'open');
  }, [quote, promptRates]);

  return ratesContextHolder;
}
