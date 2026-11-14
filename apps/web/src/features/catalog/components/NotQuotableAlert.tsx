'use client';
import { useTranslation } from 'react-i18next';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { useFeature } from '@/lib/auth/useFeature';
import { getNotQuotableHintKey } from '../helpers';

export function NotQuotableAlert({ className }: { className?: string }) {
  const { t } = useTranslation('catalog');
  const priceTiersEnabled = useFeature('priceTiers');

  return (
    <WrapperAlert
      type="warning"
      description={t(getNotQuotableHintKey(priceTiersEnabled))}
      closeable={false}
      className={className}
    />
  );
}
