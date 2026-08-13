'use client';
import { Form, Input, InputNumber, Segmented, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionGroupInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

interface OptionGroupFormProps {
  form: FormInstance<UpdateOptionGroupInput>;
  initialValues?: Partial<UpdateOptionGroupInput>;
  onSubmit: (values: UpdateOptionGroupInput) => Promise<void> | void;
}

export function OptionGroupForm({ form, initialValues, onSubmit }: OptionGroupFormProps) {
  const { t } = useTranslation('catalog');
  const selectionType = Form.useWatch('selectionType', form);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ selectionType: 'select', ...initialValues }}
      onFinish={onSubmit}
      requiredMark={false}
    >
      <Form.Item
        name="label"
        label={<FieldLabel title={t('optionGroup.form.label')} required />}
        rules={[{ required: true, message: t('validation.labelRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('optionGroup.form.labelPlaceholder')} />
      </Form.Item>

      <Form.Item name="selectionType" label={<FieldLabel title={t('optionGroup.form.selectionType')} />}>
        <Segmented
          block
          options={[
            { label: t('optionGroup.selectionType.select'), value: 'select' },
            { label: t('optionGroup.selectionType.included'), value: 'included' },
          ]}
        />
      </Form.Item>

      {selectionType === 'select' && (
        <Form.Item
          name="maxSelect"
          label={
            <FieldLabel
              title={t('optionGroup.form.maxSelect')}
              caption={t('optionGroup.form.maxSelectHelp')}
            />
          }
          preserve={false}
          className="mb-0"
        >
          <InputNumber
            min={1}
            className="w-full"
            placeholder={t('optionGroup.form.maxSelectPlaceholder')}
          />
        </Form.Item>
      )}
    </Form>
  );
}
