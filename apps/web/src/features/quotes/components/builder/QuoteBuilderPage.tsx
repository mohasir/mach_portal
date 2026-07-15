'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Drawer, Skeleton, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { computeQuoteTotals, type QuoteStage } from '@repo/schemas';
import { useProductCatalog, type Product } from '@/features/catalog';
import { useEventTypesList, type EventType } from '@/features/event-types';
import { useConfig } from '@/features/settings';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { isQuoteReadyToSend, toBuilderState, toCreateInput } from '../../helpers';
import {
  emptyBuilderState,
  QuoteBuilderProvider,
  useQuoteBuilder,
} from '../../hooks/useQuoteBuilder';
import {
  useCreateQuote,
  useQuote,
  useUpdateQuote,
  useUpdateQuoteStage,
} from '../../hooks/useQuotes';
import { ClientSection } from './ClientSection';
import { EventSection } from './EventSection';
import { LineBuilder } from './LineBuilder';
import { PricingPanel } from './PricingPanel';
import { QuotePreview } from './QuotePreview';

interface QuoteBuilderPageProps {
  quoteId?: string;
}

export function QuoteBuilderPage({ quoteId }: QuoteBuilderPageProps) {
  const { data: config, isLoading: configLoading } = useConfig();
  const { data: catalog, isLoading: catalogLoading } = useProductCatalog();
  const { data: eventTypesData, isLoading: eventTypesLoading } = useEventTypesList({
    page: 1,
    pageSize: 100,
    sortBy: 'sortOrder',
    sortDir: 'asc',
  });
  const { data: detail, isLoading: quoteLoading } = useQuote(quoteId);

  const isLoading =
    configLoading || catalogLoading || eventTypesLoading || (!!quoteId && quoteLoading);

  if (isLoading || !config || !catalog || !eventTypesData || (quoteId && !detail)) {
    return <Skeleton active paragraph={{ rows: 12 }} />;
  }

  const initialState = detail
    ? toBuilderState(detail)
    : emptyBuilderState(config.appSettings.depositRate);

  return (
    <QuoteBuilderProvider key={detail?.id ?? 'new'} initialState={initialState}>
      <QuoteBuilderContent
        quoteId={quoteId}
        stage={detail?.stage}
        catalog={catalog}
        eventTypes={eventTypesData.items}
      />
    </QuoteBuilderProvider>
  );
}

interface QuoteBuilderContentProps {
  quoteId?: string;
  stage?: QuoteStage;
  catalog: Product[];
  eventTypes: EventType[];
}

function QuoteBuilderContent({ quoteId, stage, catalog, eventTypes }: QuoteBuilderContentProps) {
  const { t } = useTranslation('quotes');
  const { message } = App.useApp();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [previewOpen, setPreviewOpen] = useState(false);
  const { state } = useQuoteBuilder();
  const { data: config } = useConfig();
  const { money } = useMoneyFormatter();

  const { createQuote, isPending: isCreating } = useCreateQuote();
  const { updateQuote, isPending: isUpdating } = useUpdateQuote();
  const { updateStage, isPending: isSending } = useUpdateQuoteStage();

  const readOnly = !!stage && stage !== 'new' && stage !== 'quoted';
  const showSendButton = !readOnly && (!stage || stage === 'new');
  const saveLabel = stage === 'quoted' ? t('builder.saveChanges') : t('builder.saveDraft');
  const isPending = isCreating || isUpdating || isSending;

  const taxRate = config?.stateSettings.find((s) => s.state === state.state)?.taxRate ?? 0;
  const totals = computeQuoteTotals({
    lines: state.lines.map((l) => ({ subtotal: l.subtotal })),
    discountType: state.discountType,
    discountValue: state.discountValue,
    taxRate,
    depositRate: state.depositRate,
  });

  const canSend = isQuoteReadyToSend(state);

  const handleSaveDraft = async () => {
    if (!state.clientId) {
      message.error(t('builder.errors.clientRequired'));
      return;
    }
    const input = toCreateInput(state);
    if (quoteId) {
      await updateQuote(quoteId, input);
      message.success(t('builder.saved'));
    } else {
      const created = await createQuote(input);
      message.success(t('builder.saved'));
      router.push(`/admin/quotes/${created.id}`);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    const input = toCreateInput(state);
    let id = quoteId;
    if (id) {
      await updateQuote(id, input);
    } else {
      const created = await createQuote(input);
      id = created.id;
    }
    await updateStage(id, 'quoted');
    message.success(t('builder.sent'));
    router.push(`/admin/quotes/${id}`);
  };

  const formContent = (
    <div className="flex flex-col gap-6">
      <ClientSection readOnly={readOnly} />
      <EventSection eventTypes={eventTypes} readOnly={readOnly} />
      <LineBuilder catalog={catalog} readOnly={readOnly} />
    </div>
  );

  const previewContent = (
    <div className="flex flex-col gap-6">
      {!readOnly && <PricingPanel totals={totals} />}
      <QuotePreview catalog={catalog} eventTypes={eventTypes} totals={totals} />
    </div>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Typography.Title level={2} className="font-heading text-brown m-0">
          {quoteId ? t('builder.editTitle') : t('builder.newTitle')}
        </Typography.Title>
        {!readOnly && isDesktop && (
          <Space>
            <Button onClick={handleSaveDraft} loading={isPending}>
              {saveLabel}
            </Button>
            {showSendButton && (
              <Button type="primary" disabled={!canSend} onClick={handleSend} loading={isPending}>
                {t('builder.send')}
              </Button>
            )}
          </Space>
        )}
      </div>

      {isDesktop ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {formContent}
          <div className="sticky top-4 self-start">{previewContent}</div>
        </div>
      ) : (
        <>
          {formContent}
          <div className="border-line fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs text-gray-500">{t('builder.pricing.total')}</span>
                <span className="font-semibold">{money(totals.total)}</span>
              </div>
              <Button size="small" onClick={() => setPreviewOpen(true)}>
                {t('builder.preview.open')}
              </Button>
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleSaveDraft} loading={isPending}>
                  {saveLabel}
                </Button>
                {showSendButton && (
                  <Button
                    className="flex-1"
                    type="primary"
                    disabled={!canSend}
                    onClick={handleSend}
                    loading={isPending}
                  >
                    {t('builder.send')}
                  </Button>
                )}
              </div>
            )}
          </div>
          <Drawer
            title={t('builder.preview.title')}
            placement="bottom"
            styles={{ wrapper: { height: '85%' } }}
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
          >
            {previewContent}
          </Drawer>
        </>
      )}
    </div>
  );
}
