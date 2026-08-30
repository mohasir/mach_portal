'use client';
import { useState } from 'react';
import { Button, Input } from 'antd';
import { Plus } from 'lucide-react';
import { TbTrashFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import type { ServiceInfo } from '@repo/schemas';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';

interface ServiceDurationsEditorProps {
  value?: ServiceInfo[];
  onChange?: (value: ServiceInfo[]) => void;
  disabled?: boolean;
}

const EMPTY_DRAFT: ServiceInfo = { label: '', duration: '' };

export function ServiceDurationsEditor({
  value = [],
  onChange,
  disabled,
}: ServiceDurationsEditorProps) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const [confirm, confirmContextHolder] = useActionConfirm();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ServiceInfo>(EMPTY_DRAFT);

  const isEditing = editingIndex !== null;
  const isDraftValid = draft.label.trim().length > 0 && draft.duration.trim().length > 0;

  const startEdit = (index: number, service: ServiceInfo) => {
    if (disabled || isEditing) return;
    setEditingIndex(index);
    setDraft(service);
  };

  const cancelEdit = () => setEditingIndex(null);

  const saveEdit = () => {
    if (editingIndex === null || !isDraftValid) return;
    const next = [...value];
    next[editingIndex] = { label: draft.label.trim(), duration: draft.duration.trim() };
    onChange?.(next);
    setEditingIndex(null);
  };

  const removeService = (index: number) => {
    if (disabled || isEditing) return;
    confirm({
      title: t('quotePdfTemplate.removeServiceConfirm.title'),
      content: t('quotePdfTemplate.removeServiceConfirm.content'),
      danger: true,
      onOk: () => onChange?.(value.filter((_, i) => i !== index)),
    });
  };

  const renderEditor = () => (
    <div className="flex flex-col gap-2">
      <Input
        autoFocus
        maxLength={100}
        placeholder={t('quotePdfTemplate.serviceLabelPlaceholder')}
        value={draft.label}
        onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
      />
      <Input.TextArea
        autoSize={{ minRows: 1 }}
        maxLength={200}
        placeholder={t('quotePdfTemplate.serviceDurationPlaceholder')}
        value={draft.duration}
        onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))}
      />
      <div className="flex justify-end gap-2">
        <Button size="small" onClick={cancelEdit}>
          {tc('cancel')}
        </Button>
        <Button type="primary" size="small" disabled={!isDraftValid} onClick={saveEdit}>
          {tc('save')}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {value.map((service, index) =>
        editingIndex === index ? (
          <div key={index}>{renderEditor()}</div>
        ) : (
          <div
            key={index}
            role="button"
            tabIndex={0}
            onClick={() => startEdit(index, service)}
            onKeyDown={(e) => e.key === 'Enter' && startEdit(index, service)}
            className={`bg-primary/5 flex items-start justify-between gap-2 rounded-xl p-2 ${
              disabled || isEditing ? '' : 'hover:bg-primary/10 cursor-pointer transition-colors'
            }`}
          >
            <div className="flex min-w-0 flex-col">
              <span className="font-medium">{service.label}</span>
              <span className="text-muted text-sm">{service.duration}</span>
            </div>
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
                  rounded="rounded-lg"
                  className="bg-salmon/20 text-error"
                />
              }
              onClick={(e) => {
                e.stopPropagation();
                removeService(index);
              }}
              aria-label={t('quotePdfTemplate.removeService')}
              disabled={disabled || isEditing}
            />
          </div>
        ),
      )}

      {editingIndex === value.length
        ? renderEditor()
        : !disabled &&
          !isEditing && (
            <Button
              type="dashed"
              onClick={() => startEdit(value.length, EMPTY_DRAFT)}
              icon={<Plus size={16} />}
              block
            >
              {t('quotePdfTemplate.addService')}
            </Button>
          )}
      {confirmContextHolder}
    </div>
  );
}
