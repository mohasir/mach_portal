'use client';
import { App } from 'antd';
import { Ban, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { canDeleteCategory } from '../helpers';
import type { ProductCategory } from '../types';

interface UseProductCategoryRowActionsParams {
  onEdit: (category: ProductCategory) => void;
  onToggleActive: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
}

export function useProductCategoryRowActions({
  onEdit,
  onToggleActive,
  onDelete,
}: UseProductCategoryRowActionsParams) {
  const { t } = useTranslation('productCategories');
  const { t: tc } = useTranslation('common');
  const vocabulary = useCatalogVocabulary();
  const { message } = App.useApp();

  return (category: ProductCategory): RowActionItem[] => [
    {
      key: 'copyId',
      onClick: () => {
        void navigator.clipboard.writeText(category.id);
        message.success(tc('table.copied'));
      },
    },
    { type: 'divider' },
    {
      key: 'edit',
      guard: { [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(category),
    },
    category.isActive
      ? {
          key: 'deactivate',
          label: t('actions.deactivate'),
          icon: <Ban size={16} />,
          danger: true,
          guard: { [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.DISABLE] },
          onClick: () => onToggleActive(category),
          confirm: {
            title: t('deactivateConfirm.title', { name: category.name }),
            content: t('deactivateConfirm.content', vocabulary),
            caption: t('deactivateConfirm.caption', vocabulary),
            okText: t('actions.deactivate'),
          },
        }
      : {
          key: 'activate',
          label: t('actions.activate'),
          icon: <RotateCcw size={16} />,
          guard: { [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.ENABLE] },
          onClick: () => onToggleActive(category),
        },
    ...(canDeleteCategory(category)
      ? [
          {
            key: 'delete',
            label: t('actions.delete'),
            icon: <Trash2 size={16} />,
            danger: true,
            guard: { [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.DELETE] },
            onClick: () => onDelete(category),
            confirm: {
              title: t('deleteConfirm.title', { name: category.name }),
              content: t('deleteConfirm.content'),
              caption: t('deleteConfirm.caption', vocabulary),
              okText: t('actions.delete'),
            },
          } satisfies RowActionItem,
        ]
      : []),
  ];
}
