'use client';
import { Button, Tag } from 'antd';
import { TbPencilFilled, TbRestore, TbTrashFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';
import { useCan } from '@/lib/auth/useCan';
import { useOptionMutations } from '../hooks/useOptionMutations';
import { useSortableRow } from '../hooks/useSortableRow';
import { useCatalogSortable } from '../hooks/useCatalogSortable';
import { ReorderControl } from './ReorderControl';
import type { Option } from '../types';

interface OptionRowProps {
  option: Option;
  onEdit: (option: Option) => void;
}

export function OptionRow({ option, onEdit }: OptionRowProps) {
  const { t } = useTranslation('catalog');
  const { t: tc } = useTranslation('common');
  const can = useCan();
  const canEdit = can({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] });
  const canDisable = can({ [RESOURCES.PRODUCT]: [ACTIONS.DISABLE] });
  const canEnable = can({ [RESOURCES.PRODUCT]: [ACTIONS.ENABLE] });
  const { disableOption, enableOption } = useOptionMutations();
  const [confirm, confirmContextHolder] = useActionConfirm();
  const sortable = useCatalogSortable();
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(option.id, sortable);

  const handleDisable = () =>
    confirm({
      title: t('option.disableConfirm.title'),
      content: t('option.disableConfirm.content'),
      danger: true,
      onOk: () => disableOption(option.id),
    });

  const handleEnable = () =>
    confirm({
      title: t('option.enableConfirm.title'),
      content: t('option.enableConfirm.content'),
      onOk: () => enableOption(option.id),
    });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-3.5 ${isDragging ? 'opacity-50' : ''}`}
    >
      <ReorderControl dragHandleProps={dragHandleProps} />
      <div className="min-w-0 flex-1">
        <div className={`truncate text-base ${option.isActive ? '' : 'text-muted'}`}>
          {option.name}
        </div>
        {option.description && (
          <div className="text-muted truncate text-xs">{option.description}</div>
        )}
      </div>
      {!option.isActive && <Tag>{t('status.inactive')}</Tag>}
      <div className="flex gap-3">
        {canEdit && (
          <Button
            type="text"
            size="small"
            shape="square"
            icon={
              <IconBadge
                icon={TbPencilFilled}
                shape="square"
                badgeSize="sm"
                size={14}
                className="bg-primary/20 text-primary"
              />
            }
            onClick={() => onEdit(option)}
            aria-label={tc('edit')}
          />
        )}
        {option.isActive
          ? canDisable && (
              <Button
                type="text"
                size="small"
                danger
                shape="square"
                icon={
                  <IconBadge
                    icon={TbTrashFilled}
                    shape="square"
                    badgeSize="sm"
                    size={14}
                    className="bg-salmon/20 text-error"
                  />
                }
                onClick={handleDisable}
                aria-label={t('actions.deactivate')}
              />
            )
          : canEnable && (
              <Button
                type="text"
                size="small"
                icon={<TbRestore size={16} />}
                onClick={handleEnable}
                aria-label={t('actions.activate')}
              />
            )}
      </div>

      {confirmContextHolder}
    </div>
  );
}
