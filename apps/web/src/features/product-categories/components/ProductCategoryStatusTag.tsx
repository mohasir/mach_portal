'use client';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProductCategory } from '../types';

export function ProductCategoryStatusTag({ category }: { category: ProductCategory }) {
  const { t } = useTranslation('productCategories');
  return (
    <Tag color={category.isActive ? 'green' : 'default'}>
      {category.isActive ? t('status.active') : t('status.inactive')}
    </Tag>
  );
}
