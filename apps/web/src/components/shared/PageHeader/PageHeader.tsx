'use client';
import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import type { MobilePageHeaderAction } from '@/lib/stores/pageHeader.store';
import { PageHeaderMobile } from './PageHeaderMobile';

interface PageHeaderProps {
  title: ReactNode;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  /** Custom action area (e.g. a button with an icon/loading state) — takes over the actionLabel/onAction slot when given. */
  actions?: ReactNode;
  /** Mobile-only: shows a logout button in the fixed topbar (see MobileTopbar). */
  showLogout?: boolean;
  /** Mobile-only: shows an icon action button in the fixed topbar (see MobileTopbar). */
  mobileAction?: MobilePageHeaderAction;
}

export function PageHeader({
  title,
  onBack,
  actionLabel,
  onAction,
  actions,
  showLogout,
  mobileAction,
}: PageHeaderProps) {
  const { t } = useTranslation('common');
  const isDesktop = useIsDesktop();

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
          onBack={onBack}
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
        {onBack && (
          <Button
            type="text"
            icon={<ArrowLeft size={18} />}
            onClick={onBack}
            aria-label={t('back')}
          />
        )}
        <Typography.Title level={1} className="font-heading text-brown m-0 min-w-0">
          {title}
        </Typography.Title>
      </div>
      {actionArea}
    </div>
  );
}
