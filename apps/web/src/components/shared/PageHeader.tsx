'use client';
import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PageHeaderProps {
  title: ReactNode;
  onBack?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  /** Custom action area (e.g. a button with an icon/loading state) — takes over the actionLabel/onAction slot when given. */
  actions?: ReactNode;
}

export function PageHeader({ title, onBack, actionLabel, onAction, actions }: PageHeaderProps) {
  const { t } = useTranslation('common');

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
        <Typography.Title level={2} className="font-heading text-brown m-0 min-w-0">
          {title}
        </Typography.Title>
      </div>
      {actions ??
        (actionLabel && onAction && (
          <Button type="primary" onClick={onAction} className="w-full sm:w-auto">
            {actionLabel}
          </Button>
        ))}
    </div>
  );
}
