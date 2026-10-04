'use client';
import { useState } from 'react';
import { Popover, Switch } from 'antd';
import { TbSettings } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { IconButton } from '@/components/shared/IconButton';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useQuotesViewOptions } from '../../hooks/useQuotesViewOptions';

/** Gear + panel with the user's own view options for the quotes page; hidden when none apply. */
export function QuotesViewSettings() {
  const { t } = useTranslation('quotes');
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const {
    viewOptions,
    canHideStale,
    canIncludeArchived,
    setHideStale,
    setIncludeArchived,
    isPending,
  } = useQuotesViewOptions();

  if (!canHideStale && !canIncludeArchived) return null;

  const content = (
    <div className="flex flex-col gap-4 px-4 py-2">
      <span className="text-muted">{t('viewSettings.title')}</span>
      {canHideStale && (
        <SwitchRow
          title={t('viewSettings.hideStale')}
          caption={t('viewSettings.hideStaleCaption')}
          control={
            <Switch
              checked={viewOptions.hideStale}
              loading={isPending}
              onChange={(checked) => void setHideStale(checked)}
            />
          }
        />
      )}
      {canIncludeArchived && (
        <SwitchRow
          title={t('viewSettings.includeArchived')}
          caption={t('viewSettings.includeArchivedCaption')}
          control={
            <Switch
              checked={viewOptions.includeArchived}
              loading={isPending}
              onChange={(checked) => void setIncludeArchived(checked)}
            />
          }
        />
      )}
    </div>
  );

  const trigger = (
    <div className="flex items-center rounded-xl">
      <IconButton
        icon={TbSettings}
        iconSize={18}
        aria-label={t('viewSettings.title')}
        onClick={isDesktop ? undefined : () => setOpen(true)}
        className="bg-primary/10 text-primary"
      />
    </div>
  );

  if (isDesktop) {
    return (
      <Popover
        trigger="click"
        placement="bottomLeft"
        open={open}
        onOpenChange={setOpen}
        arrow={false}
        content={<div className="w-80">{content}</div>}
      >
        {trigger}
      </Popover>
    );
  }

  return (
    <>
      {trigger}
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        {content}
      </BottomSheet>
    </>
  );
}
