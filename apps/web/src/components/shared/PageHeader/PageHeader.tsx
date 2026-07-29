'use client';
import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import type { MobilePageHeaderAction } from '@/lib/stores/pageHeader.store';
import { PageHeaderMobile } from './PageHeaderMobile';

interface PageHeaderProps {
  title: ReactNode;
  titleSuffix?: ReactNode;
  onBack?: boolean | (() => void);
  backHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  actions?: ReactNode;
  showLogout?: boolean;
  mobileAction?: MobilePageHeaderAction;
}

export function PageHeader({
  title,
  titleSuffix,
  onBack,
  backHref,
  actionLabel,
  onAction,
  actions,
  showLogout,
  mobileAction,
}: PageHeaderProps) {
  const { t } = useTranslation('common');
  const isDesktop = useIsDesktop();
  const router = useRouter();

  const handleBack = backHref
    ? () => router.push(backHref)
    : onBack === true
      ? () => router.back()
      : onBack || undefined;

  const actionArea =
    actions ??
    (actionLabel && onAction && (
      <Button type="primary" onClick={onAction} className="w-full sm:w-auto">
        {actionLabel}
      </Button>
    ));

  if (!isDesktop) {
    return (
      <>
        <PageHeaderMobile
          title={title}
          titleSuffix={titleSuffix}
          onBack={handleBack}
          showLogout={showLogout}
          action={mobileAction}
        />
        {/* mobileAction takes over the action slot in the topbar — don't duplicate it here. */}
        {!mobileAction && actionArea && <div className="mb-6">{actionArea}</div>}
      </>
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        {handleBack && (
          <Button
            type="text"
            icon={<ArrowLeft size={18} />}
            onClick={handleBack}
            aria-label={t('back')}
          />
        )}
        <Typography.Title level={1} className="font-heading text-brown m-0 min-w-0">
          {title}
        </Typography.Title>
        {titleSuffix}
      </div>
      {actionArea}
    </div>
  );
}
