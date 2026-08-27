'use client';
import { useState } from 'react';
import { Button, Tag } from 'antd';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { TbPencilFilled, TbRestore, TbTrashFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useCan } from '@/lib/auth/useCan';
import { useOptionGroupMutations } from '../hooks/useOptionGroupMutations';
import { useSortableRow } from '../hooks/useSortableRow';
import { useCatalogSortable } from '../hooks/useCatalogSortable';
import { ReorderControl } from './ReorderControl';
import { OptionList } from './OptionList';
import { OptionFormModal } from './OptionFormModal';
import type { Option, OptionGroup } from '../types';

interface OptionGroupPanelProps {
  group: OptionGroup;
  onEdit: (group: OptionGroup) => void;
}

export function OptionGroupPanel({ group, onEdit }: OptionGroupPanelProps) {
  const { t } = useTranslation('catalog');
  const { t: tc } = useTranslation('common');
  const can = useCan();
  const canEdit = can({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] });
  const canCreate = can({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
  const canDisable = can({ [RESOURCES.PRODUCT]: [ACTIONS.DISABLE] });
  const canEnable = can({ [RESOURCES.PRODUCT]: [ACTIONS.ENABLE] });
  const { disableOptionGroup, enableOptionGroup } = useOptionGroupMutations();
  const [confirm, confirmContextHolder] = useActionConfirm();
  const sortable = useCatalogSortable();
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(group.id, sortable);
  const [editingOption, setEditingOption] = useState<Option | null>(null);
  const [isCreateOptionOpen, setCreateOptionOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleDisable = () =>
    confirm({
      title: t('optionGroup.disableConfirm.title'),
      content: t('optionGroup.disableConfirm.content'),
      danger: true,
      onOk: () => disableOptionGroup(group.id),
    });

  const handleEnable = () =>
    confirm({
      title: t('optionGroup.enableConfirm.title'),
      content: t('optionGroup.enableConfirm.content'),
      onOk: () => enableOptionGroup(group.id),
    });

  const typeLabel =
    group.selectionType === 'included'
      ? t('optionGroup.includedShort')
      : group.maxSelect != null
        ? t('optionGroup.maxSelectShort', { count: group.maxSelect })
        : t('optionGroup.noLimitShort');

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-50' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        <ReorderControl dragHandleProps={dragHandleProps} />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown size={16} className="h-6" />
          ) : (
            <ChevronRight size={16} className="h-6" />
          )}
          <div className="min-w-0 flex-1">
            <div className={`truncate text-base font-medium ${group.isActive ? '' : 'text-muted'}`}>
              {group.label}
            </div>
            <div className="text-muted text-xs whitespace-nowrap">({typeLabel})</div>
          </div>
        </button>
        {!group.isActive && <Tag>{t('status.inactive')}</Tag>}
        <div className="flex gap-1">
          {canCreate && (
            <Button
              type="text"
              shape="square"
              icon={<IconBadge icon={Plus} shape="square" className="bg-primary/20 text-primary" />}
              onClick={() => setCreateOptionOpen(true)}
              aria-label={t('option.add')}
            />
          )}
          {canEdit && (
            <Button
              type="text"
              shape="square"
              icon={
                <IconBadge
                  icon={TbPencilFilled}
                  shape="square"
                  className="bg-primary/20 text-primary"
                />
              }
              onClick={() => onEdit(group)}
              aria-label={tc('edit')}
            />
          )}
          {group.isActive
            ? canDisable && (
                <Button
                  type="text"
                  danger
                  shape="square"
                  icon={
                    <IconBadge
                      icon={TbTrashFilled}
                      shape="square"
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
                  icon={<TbRestore size={16} />}
                  onClick={handleEnable}
                  aria-label={t('actions.activate')}
                />
              )}
        </div>
      </div>

      {expanded && (
        <WrapperCard variant="outlined" className="mt-2 bg-primary/5">
          <OptionList options={group.options} onEdit={setEditingOption} />
        </WrapperCard>
      )}

      <OptionFormModal
        optionGroupId={group.id}
        option={editingOption}
        open={!!editingOption || isCreateOptionOpen}
        onClose={() => {
          setEditingOption(null);
          setCreateOptionOpen(false);
        }}
      />

      {confirmContextHolder}
    </div>
  );
}
