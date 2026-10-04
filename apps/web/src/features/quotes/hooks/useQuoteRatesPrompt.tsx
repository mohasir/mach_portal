'use client';
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, type QuoteRateDrift, type QuoteRates } from '@repo/schemas';
import { useConfirmModal } from '@/components/shared/ConfirmDialogs';
import { useCan } from '@/lib/auth/useCan';
import { useApiError } from '@/lib/error/useApiError';
import { useTRPC } from '@/lib/trpc/client';

const RATE_KEYS: (keyof QuoteRates)[] = ['taxRate', 'cardSurchargeRate'];

const formatRate = (rate: number) => `${Math.round(rate * 100000) / 1000}%`;

function RateDriftContent({
  drift,
  changed,
}: {
  drift: QuoteRateDrift;
  changed: (keyof QuoteRates)[];
}) {
  const { t } = useTranslation('quotes');
  const single = changed.length === 1 ? changed[0] : undefined;
  return (
    <span className="flex flex-col gap-2">
      {changed.map((key) => (
        <span key={key} className="flex flex-col gap-1">
          <span>{t(`rateDrift.${key}.saved`, { rate: formatRate(drift.saved[key]) })}</span>
          <span className="font-medium text-foreground">
            {t(`rateDrift.${key}.current`, { rate: formatRate(drift.current[key]) })}
          </span>
        </span>
      ))}
      <span>{t(`rateDrift.${single ?? 'both'}.totalWarning`)}</span>
    </span>
  );
}

/**
 * The one place that asks whether a pending quote should take the current config rates (tax by
 * state, card surcharge) after they changed. `promptRates` looks the difference up and asks;
 * `askAboutDrift` asks about one already loaded. Both resolve `true` once the user has answered
 * (or right away when there's nothing to ask) and `false` if saving the answer failed, so a
 * caller can chain the action it was about to do.
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

  const askAboutDrift = (quoteId: string, changes: QuoteRateDrift) => {
    const changed = RATE_KEYS.filter((key) => changes.saved[key] !== changes.current[key]);
    // One rate: the buttons name the values, so the choice reads at a glance.
    const single = changed.length === 1 ? changed[0] : undefined;

    return new Promise<boolean>((done) => {
      const answer = (accept: boolean) =>
        resolveDrift
          .mutateAsync({ id: quoteId, accept })
          .then(() => done(true))
          .catch(() => done(false));
      confirm({
        type: 'warning',
        dismissible: false,
        title: t(`rateDrift.${single ?? 'both'}.title`),
        content: <RateDriftContent drift={changes} changed={changed} />,
        okText: single
          ? t('rateDrift.apply', { rate: formatRate(changes.current[single]) })
          : t('rateDrift.both.apply'),
        cancelText: single
          ? t('rateDrift.keep', { rate: formatRate(changes.saved[single]) })
          : t('rateDrift.both.keep'),
        onOk: () => void answer(true),
        onCancel: () => void answer(false),
      });
    });
  };

  const promptRates = async (quoteId: string) => {
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
    return drift ? askAboutDrift(quoteId, drift) : true;
  };

  return { promptRates, askAboutDrift, ratesContextHolder };
}

/**
 * Asks once when a pending quote is opened in the builder. The difference is fetched alongside
 * the quote itself (from the id, not after the quote loads), so the question shows up as soon as
 * the quote does.
 */
export function useQuoteRatesCheckOnOpen(
  quoteId: string | undefined,
  quote: { id: string; stageId: number; isArchived: boolean } | undefined,
) {
  const trpc = useTRPC();
  const can = useCan();
  const { askAboutDrift, ratesContextHolder } = useQuoteRatesPrompt();
  const checkedFor = useRef<string | undefined>(undefined);
  const { data: drift, isFetchedAfterMount } = useQuery({
    ...trpc.quotes.rateDrift.queryOptions({ id: quoteId! }),
    enabled: !!quoteId && can({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] }),
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    // A cached answer from an earlier visit may be outdated; only a fresh one is asked about.
    if (!quote || !drift || !isFetchedAfterMount) return;
    if (quote.stageId !== QUOTE_STAGE.PENDING || quote.isArchived) return;
    if (checkedFor.current === quote.id) return;
    checkedFor.current = quote.id;
    void askAboutDrift(quote.id, drift);
  }, [quote, drift, isFetchedAfterMount, askAboutDrift]);

  return ratesContextHolder;
}
