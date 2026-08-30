'use client';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { HelpCategoryList } from './HelpCategoryList';

export function SupportPage() {
  const { t } = useTranslation('support');

  return (
    <div>
      <PageHeader title={t('title')} backHref="/admin/settings" />
      <div className="px-3">
        <HelpCategoryList />
      </div>
    </div>
  );
}
