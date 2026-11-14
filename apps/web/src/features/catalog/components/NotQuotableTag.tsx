'use client';
import { Tag } from 'antd';
import { Ban } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NotQuotableTag() {
  const { t } = useTranslation('catalog');

  return (
    <Tag color="orange" icon={<Ban size={12} />} className="m-0">
      {t('product.notQuotable.tag')}
    </Tag>
  );
}
