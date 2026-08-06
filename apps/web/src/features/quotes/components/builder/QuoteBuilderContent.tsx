'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Card, Divider, Tooltip } from 'antd';
import { Copy } from 'lucide-react';
import { TbLink } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { TRPCClientError } from '@trpc/client';
import { computeQuoteTotals, QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import type { EventType } from '@/features/event-types';
import { useConfirmModal, type ConfirmModalType } from '@/components/shared/ConfirmDialogs';
import { PageHeader } from '@/components/shared/PageHeader';
import { useConfig } from '@/features/settings';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useApiError } from '@/lib/error/useApiError';
import { copyToClipboard } from '@/lib/utils/clipboard';
import { hasBuilderChanges, hasClient, isQuoteReadyToSend, toCreateInput } from '../../helpers';
import { useQuoteBuilder } from '../../hooks/useQuoteBuilder';
import { useCreateQuote, useUpdateQuote } from '../../hooks/useQuotes';
import { QuoteStageTagDropdown } from '../QuoteStageTagDropdown';
import { QuoteSummary } from '../QuoteSummary';
import { ClientSection, type ApiFieldError, type ClientSectionHandle } from './ClientSection';
import { EventSection } from './EventSection';
import { ExtraChargesSection } from './ExtraChargesSection';
import { NotesSection } from './NotesSection';
import { QuotePreview } from './QuotePreview';
import { LinesBuilderSection } from './LinesBuilderSection';

interface QuoteBuilderContentProps {
  quoteId?: string;
  number?: string;
  stageId?: QuoteStageId;
  isDraft?: boolean;
  catalog: Product[];
  eventTypes: EventType[];
}

export function QuoteBuilderContent({
  quoteId,
  number,
  stageId,
  isDraft,
  catalog,
  eventTypes,
}: QuoteBuilderContentProps) {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const { message, modal } = App.useApp();
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { state, initialState } = useQuoteBuilder();
  const { data: config } = useConfig();
  const { money } = useMoneyFormatter();
  const clientSectionRef = useRef<ClientSectionHandle>(null);
  const onApiError = useApiError();
  const [confirmExit, exitContextHolder] = useConfirmModal();
  const isDirty = hasBuilderChanges(state, initialState);

  const { createQuote } = useCreateQuote();
  const { updateQuote } = useUpdateQuote();
  const [pendingAction, setPendingAction] = useState<'draft' | 'send' | null>(null);

  const readOnly = !!stageId && stageId !== QUOTE_STAGE.PENDING && stageId !== QUOTE_STAGE.QUOTED;
  // The "create quote" action only makes sense while there's still a draft to graduate from —
  // once a quote is saved as non-draft, editing it only offers "Actualizar" (see saveLabel below).
  const showSendButton =
    !readOnly && (!stageId || stageId === QUOTE_STAGE.PENDING) && (!quoteId || !!isDraft);
  const isUpdateAction = stageId !== QUOTE_STAGE.QUOTED && !!quoteId && !isDraft;
  const saveLabel =
    stageId === QUOTE_STAGE.QUOTED
      ? t('builder.saveChanges')
      : isUpdateAction
        ? t('builder.update')
        : t('builder.saveDraft');

  const taxRate = config?.stateSettings.find((s) => s.state === state.state)?.taxRate ?? 0;
  const totals = computeQuoteTotals({
    lines: state.lines.map((l) => ({ subtotal: l.subtotal })),
    discountType: state.discountType,
    discountValue: state.discountValue,
    longDistanceAmount: state.longDistanceAmount,
    taxRate,
    depositRate: state.depositRate,
  });

  const canSend = isQuoteReadyToSend(state);

  // create/update don't have their own onError (see useQuotes.ts) — a failed client lookup can
  // fail on `newClient.*` (owned by ClientSection) as easily as on a top-level quote field, so
  // routing decides where to show it instead of a single generic toast.
  // `update`'s input is `{ id, data: updateQuoteSchema }`, so a `data.newClient.email` issue
  // there comes back as `['data', 'newClient', 'email']` — one level deeper than on `create`
  // (`['newClient', 'email']`) — normalize both before handing off to ClientSection.
  const reportSaveError = (error: unknown) => {
    if (error instanceof TRPCClientError) {
      const fieldErrors = (
        error.data as { fieldErrors?: ApiFieldError[] | null } | null | undefined
      )?.fieldErrors;
      const clientFieldErrors = fieldErrors
        ?.map((fe) => {
          const i = fe.path.indexOf('newClient');
          return i === -1 ? null : { ...fe, path: fe.path.slice(i) };
        })
        .filter((fe): fe is ApiFieldError => fe !== null);
      if (clientFieldErrors?.length) {
        clientSectionRef.current?.setFieldErrors(clientFieldErrors);
        return;
      }
    }
    onApiError(error);
  };

  const handleSaveDraft = async () => {
    if (!hasClient(state)) {
      message.error(t('builder.errors.clientRequired'));
      return;
    }
    const input = toCreateInput(state, quoteId ? !!isDraft : true);
    setPendingAction('draft');
    try {
      if (quoteId) {
        await updateQuote(quoteId, input);
      } else {
        await createQuote(input);
      }
      message.success(t('builder.saved'));
      router.push('/admin/quotes?view=pipeline');
    } catch (error) {
      reportSaveError(error);
    } finally {
      setPendingAction(null);
    }
  };

  const handleSend = async () => {
    if (!canSend) return;
    const input = toCreateInput(state, false);
    const isNew = !quoteId;
    let id = quoteId;
    setPendingAction('send');
    try {
      if (id) {
        await updateQuote(id, input);
      } else {
        const created = await createQuote(input);
        id = created.id;
      }
    } catch (error) {
      reportSaveError(error);
      return;
    } finally {
      setPendingAction(null);
    }
    message.success(t('builder.created'));
    router.push(isNew ? '/admin/quotes?view=pipeline' : `/admin/quotes/${id}`);
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(window.location.href);
    if (ok) message.success(tc('share.linkCopied'));
  };

  const handleCloneNumber = async () => {
    if (!number) return;
    const ok = await copyToClipboard(number);
    if (ok) message.success(t('pipeline.numberCopied'));
  };

  const handleBack = () => {
    if (!isDirty) {
      router.back();
      return;
    }
    const options = {
      title: t('builder.exitConfirm.title'),
      content: t('builder.exitConfirm.content'),
      okText: t('builder.exitConfirm.ok'),
      cancelText: t('builder.exitConfirm.cancel'),
      danger: false,
      onOk: () => router.back(),
    };
    if (!isDesktop) return confirmExit({ ...options, type: 'warning' as ConfirmModalType });
    modal.confirm({ ...options, okButtonProps: { danger: true } });
  };

  const formFields = (
    <div className={`flex flex-col ${isDesktop ? '' : 'gap-4'}`}>
      {quoteId && stageId && (
        <Card>
          <QuoteStageTagDropdown quoteId={quoteId} stageId={stageId} isDraft={isDraft} />
        </Card>
      )}
      <ClientSection ref={clientSectionRef} readOnly={readOnly} />
      {!isDesktop && (
        <>
          <Card>
            <LinesBuilderSection catalog={catalog} readOnly={readOnly} />
          </Card>
          <ExtraChargesSection readOnly={readOnly} />
          <Card className="border-line border-2">
            <QuoteSummary
              subtotal={totals.subtotal}
              discountAmount={totals.discountAmount}
              longDistanceAmount={totals.longDistanceAmount}
              taxAmount={totals.taxAmount}
              total={totals.total}
              depositRate={totals.depositRate}
              depositAmount={totals.depositAmount}
            />
          </Card>
        </>
      )}
      {isDesktop && <Divider />}
      <EventSection eventTypes={eventTypes} readOnly={readOnly} />
      {isDesktop && (
        <>
          <Divider className="mt-2 mb-6" />
          <LinesBuilderSection catalog={catalog} readOnly={readOnly} />
        </>
      )}
      {isDesktop && <Divider className="my-4" />}
      <NotesSection readOnly={readOnly} />
    </div>
  );

  const previewContent = (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <QuotePreview catalog={catalog} eventTypes={eventTypes} totals={totals} readOnly={readOnly} />
    </div>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <PageHeader
        title={
          quoteId && number ? number : quoteId ? t('builder.editTitle') : t('builder.newTitle')
        }
        titleSize="sm"
        titleSuffix={
          quoteId && number ? (
            <div className="flex items-center gap-1">
              <Tooltip title={t('pipeline.cloneNumber')}>
                <Button
                  type="text"
                  size="small"
                  icon={<Copy size={16} />}
                  onClick={() => void handleCloneNumber()}
                />
              </Tooltip>
              <Tooltip title={tc('share.copyLink')}>
                <Button
                  type="text"
                  size="small"
                  icon={<TbLink size={18} />}
                  onClick={() => void handleCopyLink()}
                />
              </Tooltip>
            </div>
          ) : undefined
        }
        onBack={handleBack}
      />
      {isDesktop ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_480px]">
          <Card classNames={{ body: 'p-0 lg:p-[22px]' }}>{formFields}</Card>
          <div>
            <div className="sticky top-4 flex h-[calc(100vh-6rem)] flex-col gap-4">
              <Card className="min-h-0 flex-1" classNames={{ body: 'flex h-full flex-col' }}>
                {previewContent}
              </Card>
              {!readOnly && (
                <div className="flex mb-20 shrink-0 gap-2">
                  <Button
                    className="flex-1"
                    color={isUpdateAction ? 'green' : undefined}
                    variant={isUpdateAction ? 'solid' : 'outlined'}
                    onClick={handleSaveDraft}
                    loading={pendingAction === 'draft'}
                    disabled={pendingAction === 'send'}
                  >
                    {saveLabel}
                  </Button>
                  {showSendButton && (
                    <Button
                      className="flex-1"
                      type="primary"
                      disabled={!canSend || pendingAction === 'draft'}
                      onClick={handleSend}
                      loading={pendingAction === 'send'}
                    >
                      {t('builder.createQuote')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {formFields}
          <div className="border-line fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t bg-white p-3">
            <div className="flex flex-col">
              <span className="text-gray-500">{t('builder.pricing.total')}</span>
              <span className="font-semibold text-lg">{money(totals.total)}</span>
            </div>
            {!readOnly && (
              <div className="flex mb-4 gap-2">
                <Button
                  className="flex-1"
                  type={isUpdateAction ? 'primary' : undefined}
                  variant={isUpdateAction ? 'solid' : 'outlined'}
                  onClick={handleSaveDraft}
                  loading={pendingAction === 'draft'}
                  disabled={pendingAction === 'send'}
                >
                  {saveLabel}
                </Button>
                {showSendButton && (
                  <Button
                    className="flex-1"
                    type="primary"
                    disabled={!canSend || pendingAction === 'draft'}
                    onClick={handleSend}
                    loading={pendingAction === 'send'}
                  >
                    {t('builder.createQuote')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {exitContextHolder}
    </div>
  );
}
