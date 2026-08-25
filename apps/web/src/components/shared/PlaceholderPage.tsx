'use client';
import { Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';

/** Página placeholder para secciones aún sin implementar. */
export function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation('admin');

  return (
    <div>
      <PageHeader title={t(titleKey)} />
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} className="mt-16">
        <Typography.Text className="text-muted">{t('placeholder.comingSoon')}</Typography.Text>
      </Empty>
    </div>
  );
}
