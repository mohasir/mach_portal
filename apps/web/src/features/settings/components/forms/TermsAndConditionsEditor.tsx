'use client';
import { useState } from 'react';
import { Button, Input } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TbTrashFilled } from 'react-icons/tb';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';

interface TermsAndConditionsEditorProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  maxLength?: number;
}

export function TermsAndConditionsEditor({
  value = [],
  onChange,
  disabled,
  maxLength = 300,
}: TermsAndConditionsEditorProps) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const [confirm, confirmContextHolder] = useActionConfirm();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const isEditing = editingIndex !== null;

  const startEdit = (index: number, text: string) => {
    if (disabled || isEditing) return;
    setEditingIndex(index);
    setDraft(text);
  };

  const cancelEdit = () => setEditingIndex(null);

  const saveEdit = () => {
    if (editingIndex === null) return;
    const text = draft.trim();
    if (!text) return cancelEdit();
    const next = [...value];
    next[editingIndex] = text;
    onChange?.(next);
    setEditingIndex(null);
  };

  const removeTerm = (index: number) => {
    if (disabled || isEditing) return;
    confirm({
      title: t('quotePdfTemplate.removeTermConfirm.title'),
      content: t('quotePdfTemplate.removeTermConfirm.content'),
      danger: true,
      onOk: () => onChange?.(value.filter((_, i) => i !== index)),
    });
  };

  const renderEditor = () => (
    <div className="flex flex-col gap-2">
      <Input.TextArea
        autoFocus
        autoSize={{ minRows: 1 }}
        maxLength={maxLength}
        placeholder={t('quotePdfTemplate.termPlaceholder')}
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
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      {value.map((term, index) =>
        editingIndex === index ? (
          <div key={index}>{renderEditor()}</div>
        ) : (
          <div
            key={index}
            role="button"
            tabIndex={0}
            onClick={() => startEdit(index, term)}
            onKeyDown={(e) => e.key === 'Enter' && startEdit(index, term)}
            className={`bg-primary/5 flex items-center justify-between gap-2 rounded-xl p-2 ${
              disabled || isEditing ? '' : 'hover:bg-primary/10 cursor-pointer transition-colors'
            }`}
          >
            <span className="truncate">{term}</span>
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
                removeTerm(index);
              }}
              aria-label={t('quotePdfTemplate.removeTerm')}
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
              onClick={() => startEdit(value.length, '')}
              icon={<Plus size={16} />}
              block
            >
              {t('quotePdfTemplate.addTerm')}
            </Button>
          )}
      {confirmContextHolder}
    </div>
  );
}
