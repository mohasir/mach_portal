'use client';
import { Button, Form, Input, InputNumber, Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionGroupInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

interface OptionGroupFormProps {
  initialValues?: Partial<UpdateOptionGroupInput>;
  onSubmit: (values: UpdateOptionGroupInput) => Promise<void> | void;
  isPending: boolean;
}

export function OptionGroupForm({ initialValues, onSubmit, isPending }: OptionGroupFormProps) {
  const { t } = useTranslation('catalog');
  const [form] = Form.useForm<UpdateOptionGroupInput>();
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
          label={<FieldLabel title={t('optionGroup.form.maxSelect')} />}
          help={t('optionGroup.form.maxSelectHelp')}
          preserve={false}
        >
          <InputNumber
            min={1}
            className="w-full"
            placeholder={t('optionGroup.form.maxSelectPlaceholder')}
          />
        </Form.Item>
      )}

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
