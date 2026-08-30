'use client';
import { useState } from 'react';
import { Button, Input } from 'antd';
import { Plus } from 'lucide-react';
import { TbTrashFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';

interface NoteCardEditorProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  addLabel: string;
  removeLabel: string;
  removeConfirmTitle: string;
  removeConfirmContent: string;
}

export function NoteCardEditor({
  value,
  onChange,
  disabled,
  maxLength = 300,
  placeholder,
  addLabel,
  removeLabel,
  removeConfirmTitle,
  removeConfirmContent,
}: NoteCardEditorProps) {
  const { t: tc } = useTranslation('common');
  const [confirm, confirmContextHolder] = useActionConfirm();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    if (disabled) return;
    setDraft(value ?? '');
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = () => {
    onChange?.(draft.trim() || undefined);
    setIsEditing(false);
  };

  const removeNote = () => {
    if (disabled) return;
    confirm({
      title: removeConfirmTitle,
      content: removeConfirmContent,
      danger: true,
      onOk: () => onChange?.(undefined),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {isEditing ? (
        <>
          <Input.TextArea
            autoFocus
            autoSize={{ minRows: 2 }}
            maxLength={maxLength}
            showCount
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="small" onClick={cancelEdit}>
              {tc('cancel')}
            </Button>
            <Button type="primary" size="small" onClick={saveEdit}>
              {tc('save')}
            </Button>
          </div>
        </>
      ) : value ? (
        <div
          role="button"
          tabIndex={0}
          onClick={startEdit}
          onKeyDown={(e) => e.key === 'Enter' && startEdit()}
          className={`bg-primary/5 flex items-start justify-between gap-2 rounded-xl p-2 ${
            disabled ? '' : 'hover:bg-primary/10 cursor-pointer transition-colors'
          }`}
        >
          <span className="whitespace-pre-line">{value}</span>
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
              removeNote();
            }}
            aria-label={removeLabel}
            disabled={disabled}
          />
        </div>
      ) : (
        !disabled && (
          <Button type="dashed" onClick={startEdit} icon={<Plus size={16} />} block>
            {addLabel}
          </Button>
        )
      )}
      {confirmContextHolder}
    </div>
  );
}
