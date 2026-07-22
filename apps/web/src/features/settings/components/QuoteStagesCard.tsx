'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, ColorPicker, Form, Input, Skeleton, Tag } from 'antd';
import type { InputRef } from 'antd';
import type { Color } from 'antd/es/color-picker';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { TAG_COLOR_PRESETS } from '../contants';
import { useCan } from '@/lib/auth/useCan';
import { FieldRow } from '@/components/shared/Inputs/FieldRow';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../hooks/useConfig';
import { useUpdateQuoteStagesConfig } from '../hooks/useUpdateQuoteStagesConfig';
import {
  toQuoteStagesFormValues,
  toQuoteStagesUpdateInput,
  type QuoteStagesFormValues,
} from '../helpers';
import { SettingsCard } from './SettingsCard';

interface QuoteStageRowProps {
  index: number;
  caption?: string | null;
  canEdit: boolean;
}

function QuoteStageRow({ index, caption, canEdit }: QuoteStageRowProps) {
  const { t } = useTranslation('settings');
  const form = Form.useFormInstance();
  const color: string | undefined = Form.useWatch(['quoteStages', index, 'color'], form);
  const label: string | undefined = Form.useWatch(['quoteStages', index, 'label'], form);
  const [editingLabel, setEditingLabel] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (editingLabel) inputRef.current?.focus({ cursor: 'all' });
  }, [editingLabel]);

  const nameLabel = (
    <div className="flex flex-col gap-1">
      <Form.Item
        name={['quoteStages', index, 'label']}
        rules={[{ required: true, message: t('validation.quoteStagesLabelInvalid') }]}
        className="mb-0"
        hidden={!editingLabel}
      >
        <Input
          ref={inputRef}
          maxLength={40}
          placeholder={t('quoteStages.label')}
          onBlur={() => setEditingLabel(false)}
          onPressEnter={() => setEditingLabel(false)}
        />
      </Form.Item>

      {!editingLabel && (
        <div className="flex items-center gap-1.5">
          <span>{label || t('quoteStages.label')}</span>
          {canEdit && (
            <Button
              type="text"
              size="small"
              title={t('common:edit')}
              aria-label={t('common:edit')}
              icon={<Pencil size={14} className="text-muted" />}
              onClick={() => setEditingLabel(true)}
            />
          )}
        </div>
      )}
      {caption && <span className="text-gray-500 text-xs font-normal md:w-[80%]">{caption}</span>}
    </div>
  );

  return (
    <>
      <FieldRow label={nameLabel}>
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-center justify-center gap-1">
            <Form.Item
              name={['quoteStages', index, 'color']}
              noStyle
              getValueFromEvent={(colorValue: Color) => colorValue.toHexString()}
            >
              <ColorPicker
                presets={TAG_COLOR_PRESETS}
                disabledAlpha
                format="hex"
                disabledFormat
                className="h-8 w-16"
                classNames={{ body: 'w-full h-full' }}
              />
            </Form.Item>
            <small className="text-gray-500 text-xs font-normal">{color}</small>
          </div>
          <Tag color={color} className="m-0 mt-1.5">
            {label || t('quoteStages.label')}
          </Tag>
        </div>
      </FieldRow>

      <Form.Item name={['quoteStages', index, 'id']} hidden>
        <Input type="hidden" />
      </Form.Item>
    </>
  );
}

export function QuoteStagesCard() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updateQuoteStages, isPending } = useUpdateQuoteStagesConfig();
  const [form] = Form.useForm<QuoteStagesFormValues>();
  const unchanged = useIsFormUnchanged(form, data ? toQuoteStagesFormValues(data) : undefined);

  if (!can({ [RESOURCES.QUOTE_STAGES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 4 }} />;

  const canEdit = can({ [RESOURCES.QUOTE_STAGES]: [ACTIONS.UPDATE] });
  const onFinish = (values: QuoteStagesFormValues) => {
    void updateQuoteStages(toQuoteStagesUpdateInput(values));
  };

  return (
    <Form
      key={JSON.stringify(data.quoteStages)}
      form={form}
      layout="vertical"
      initialValues={toQuoteStagesFormValues(data)}
      onFinish={onFinish}
      disabled={!canEdit}
    >
      <SettingsCard title={t('quoteStages.title')}>
        {data.quoteStages.map((s, index) => (
          <QuoteStageRow key={s.id} index={index} caption={s.description} canEdit={canEdit} />
        ))}
      </SettingsCard>

      {canEdit && (
        <Button
          type="primary"
          htmlType="submit"
          loading={isPending}
          disabled={unchanged}
          className="mt-6"
        >
          {t('save')}
        </Button>
      )}
    </Form>
  );
}
