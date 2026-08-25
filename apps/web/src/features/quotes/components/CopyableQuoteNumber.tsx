'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { copyToClipboard } from '@/lib/utils/clipboard';

interface CopyableQuoteNumberProps {
  number: string;
  className?: string;
}

export function CopyableQuoteNumber({ number, className }: CopyableQuoteNumberProps) {
  const { t } = useTranslation('quotes');
  const { message } = App.useApp();

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(number);
    if (ok) message.success(t('pipeline.numberCopied'));
  };

  return (
    <span className={`cursor-pointer ${className ?? ''}`} onClick={handleClick}>
      {number}
    </span>
  );
}
