'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from 'antd';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { useProductCatalog } from '@/features/catalog';
import { useEventTypesList } from '@/features/event-types';
import { useConfig } from '@/features/settings';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { toBuilderState } from '../../helpers';
import { emptyBuilderState, QuoteBuilderProvider } from '../../hooks/useQuoteBuilder';
import { useQuote } from '../../hooks/useQuotes';
import { QuoteBuilderContent } from './QuoteBuilderContent';

interface QuoteBuilderPageProps {
  quoteId?: string;
}

export function QuoteBuilderPage({ quoteId }: QuoteBuilderPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillClientId = searchParams.get('clientId');
  const prefillClientName = searchParams.get('clientName');
  const prefillEventDate = searchParams.get('eventDate');
  const { data: config, isLoading: configLoading } = useConfig();
  const { data: catalog, isLoading: catalogLoading } = useProductCatalog();
  const { data: eventTypesData, isLoading: eventTypesLoading } = useEventTypesList({
    page: 1,
    pageSize: 100,
    sortBy: 'sortOrder',
    sortDir: 'asc',
  });
  const { data: detail, isLoading: quoteLoading } = useQuote(quoteId);
  const setContentBg = useLayoutStore((s) => s.setContentBg);

  const stageId = detail?.stageId as QuoteStageId | undefined;
  const isEditable = !stageId || stageId === QUOTE_STAGE.PENDING || stageId === QUOTE_STAGE.QUOTED;

  useEffect(() => {
    if (quoteId && detail && !isEditable) {
      router.replace(`/admin/quotes/preview/${quoteId}`);
    }
  }, [quoteId, detail, isEditable, router]);

  useEffect(() => {
    setContentBg('grey');
    return () => setContentBg('white');
  }, [setContentBg]);

  const isLoading =
    configLoading || catalogLoading || eventTypesLoading || (!!quoteId && quoteLoading);

  if (
    isLoading ||
    !config ||
    !catalog ||
    !eventTypesData ||
    (quoteId && !detail) ||
    (quoteId && detail && !isEditable)
  ) {
    return <Skeleton active paragraph={{ rows: 12 }} />;
  }

  const initialState = detail
    ? toBuilderState(detail)
    : emptyBuilderState(
        config.appSettings.depositRate,
        prefillClientId && prefillClientName
          ? { clientId: prefillClientId, clientName: prefillClientName }
          : undefined,
        prefillEventDate ?? undefined,
      );

  return (
    <QuoteBuilderProvider key={detail?.id ?? 'new'} initialState={initialState}>
      <QuoteBuilderContent
        quoteId={quoteId}
        number={detail?.number}
        stageId={stageId}
        isDraft={detail?.isDraft}
        catalog={catalog}
        eventTypes={eventTypesData.items}
      />
    </QuoteBuilderProvider>
  );
}
