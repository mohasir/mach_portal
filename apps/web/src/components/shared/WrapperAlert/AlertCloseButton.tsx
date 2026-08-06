'use client';
import { Button } from 'antd';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AlertColorSet } from './types';

interface AlertCloseButtonProps {
  colors: AlertColorSet;
  onClose: () => void;
  className?: string;
}

export function AlertCloseButton({ colors, onClose, className }: AlertCloseButtonProps) {
  const { t } = useTranslation('common');

  return (
    <Button
      type="text"
      shape="circle"
      size="small"
      onClick={onClose}
      aria-label={t('close')}
      icon={<X size={14} className={colors.iconColor} />}
      className={`${colors.close} ${className ?? ''}`}
    />
  );
}
