'use client';
import { Button } from 'antd';
import { useState } from 'react';
import { AlertCloseButton } from './AlertCloseButton';
import { AlertContent } from './AlertContent';
import { ALERT_COLORS, DEFAULT_ICON_BY_TYPE } from './constants';
import type { WrapperAlertProps } from './types';

export function WrapperAlert({
  type = 'info',
  icon,
  title,
  description,
  showIcon = true,
  closeable = true,
  onClose,
  className,
  actionText,
  onAction,
}: WrapperAlertProps) {
  const [closed, setClosed] = useState(false);

  if (closed) return null;

  const colors = ALERT_COLORS[type];

  const handleClose = () => {
    setClosed(true);
    onClose?.();
  };

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-2xl border p-4 pl-3 ${colors.bg} ${colors.border} ${className ?? ''}`}
    >
      {closeable && (
        <AlertCloseButton
          colors={colors}
          onClose={handleClose}
          className="absolute top-2 right-2"
        />
      )}
      <div className="pr-8">
        <AlertContent
          iconType={icon ?? DEFAULT_ICON_BY_TYPE[type]}
          iconColorClass={colors.iconColor}
          title={title}
          description={description}
          showIcon={showIcon}
        />
      </div>
      {actionText && onAction && (
        <Button
          onClick={onAction}
          size="small"
          className={`mt-1 h-7 w-fit border-none ${colors.buttonBg} ${colors.buttonText}`}
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}
