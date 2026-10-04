'use client';
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, type QuoteRateDrift, type QuoteRates } from '@repo/schemas';
import { useConfirmModal } from '@/components/shared/ConfirmDialogs';
import { useConfig } from '@/features/settings';
import { useCan } from '@/lib/auth/useCan';
import { useApiError } from '@/lib/error/useApiError';
import { useTRPC } from '@/lib/trpc/client';
import { toDisplayPercent } from '@/lib/utils/percent';

const RATE_KEYS: (keyof QuoteRates)[] = ['taxRate', 'cardSurchargeRate'];

function RateDriftContent({
  drift,
  changed,
}: {
  drift: QuoteRateDrift;
  changed: (keyof QuoteRates)[];
}) {
  const { t } = useTranslation('quotes');
  const single = changed.length === 1 ? changed[0] : undefined;
  const bold = { bold: <strong className="font-semibold text-foreground" /> };

  if (single) {
    const direction = drift.current[single] > drift.saved[single] ? 'up' : 'down';
    return (
      <Trans
        t={t}
        i18nKey={`rateDrift.${single}.${direction}`}
        values={{
          saved: toDisplayPercent(drift.saved[single]),
          current: toDisplayPercent(drift.current[single]),
        }}
        components={bold}
      />
    );
  }
  return (
    <Trans
      t={t}
      i18nKey="rateDrift.both.body"
      values={{
        savedTax: toDisplayPercent(drift.saved.taxRate),
        currentTax: toDisplayPercent(drift.current.taxRate),
        savedSurcharge: toDisplayPercent(drift.saved.cardSurchargeRate),
        currentSurcharge: toDisplayPercent(drift.current.cardSurchargeRate),
      }}
      components={bold}
    />
  );
}

/** Whether this user should be asked at all: the feature is on and they can reprice quotes. */
function useRatePromptEnabled() {
  const can = useCan();
  const { data: config } = useConfig();
  return !!config?.appSettings.promptRateChanges && can({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] });
}

/**
 * The one place that asks whether a pending quote should take the current config rates (tax by
 * state, card surcharge) after they changed. `promptRates` looks the difference up and asks;
 * `askAboutDrift` asks about one already loaded. Both resolve `true` once the user has answered
 * (or right away when there's nothing to ask) and `false` when the caller should stop (the
 * lookup or saving the answer failed), so a caller can chain the action it was about to do.
 */
export function useQuoteRatesPrompt() {
  const { t } = useTranslation('quotes');
  const trpc = useTRPC();
  const qc = useQueryClient();
  const enabled = useRatePromptEnabled();
  const onError = useApiError();
  const [confirm, ratesContextHolder] = useConfirmModal();
  // One dialog state is shared, so questions run one at a time; otherwise a second one (two
  // quotes dropped in a row) would replace the first and its answer would never arrive.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const resolveDrift = useMutation(
    trpc.quotes.resolveRateDrift.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.quotes.pathFilter()),
      onError,
    }),
  );

  const ask = (quoteId: string, changes: QuoteRateDrift) => {
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
          ? t('rateDrift.apply', { rate: toDisplayPercent(changes.current[single]) })
          : t('rateDrift.both.apply'),
        cancelText: single
          ? t('rateDrift.keep', { rate: toDisplayPercent(changes.saved[single]) })
          : t('rateDrift.both.keep'),
        onOk: () => void answer(true),
        onCancel: () => void answer(false),
      });
    });
  };

  const askAboutDrift = (quoteId: string, changes: QuoteRateDrift) => {
    const turn = queue.current.then(() => ask(quoteId, changes));
    queue.current = turn.catch(() => undefined);
    return turn;
  };

  const promptRates = async (quoteId: string) => {
    if (!enabled) return true;

    let drift: QuoteRateDrift | null;
    try {
      drift = await qc.fetchQuery({
        ...trpc.quotes.rateDrift.queryOptions({ id: quoteId }),
        staleTime: 0,
      });
    } catch (error) {
      // Out of the caller's scope: nothing it could reprice, so nothing to ask. Any other failure
      // stops the caller, since sending now would freeze rates nobody was asked about.
      const code = (error as { data?: { code?: string } }).data?.code;
      if (code === 'NOT_FOUND' || code === 'FORBIDDEN') return true;
      onError(error);
      return false;
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
  const enabled = useRatePromptEnabled();
  const { askAboutDrift, ratesContextHolder } = useQuoteRatesPrompt();
  // Latest closure without making the effect re-run on every builder render.
  const askRef = useRef(askAboutDrift);
  useEffect(() => {
    askRef.current = askAboutDrift;
  });
  const checkedFor = useRef<string | undefined>(undefined);
  const { data: drift, isFetchedAfterMount } = useQuery({
    ...trpc.quotes.rateDrift.queryOptions({ id: quoteId! }),
    enabled: !!quoteId && enabled,
    staleTime: 0,
    retry: false,
  });

  const id = quote?.id;
  const askable = quote?.stageId === QUOTE_STAGE.PENDING && !quote.isArchived;
  useEffect(() => {
    // A cached answer from an earlier visit may be outdated; only a fresh one is asked about.
    if (!id || !askable || !drift || !isFetchedAfterMount) return;
    if (checkedFor.current === id) return;
    checkedFor.current = id;
    void askRef.current(id, drift);
  }, [id, askable, drift, isFetchedAfterMount]);

  return ratesContextHolder;
}
