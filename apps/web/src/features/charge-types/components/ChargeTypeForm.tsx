'use client';
import { Button, Form, Input, Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { CHARGE_KINDS, type CreateChargeTypeInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { PercentInput } from '@/components/shared/Inputs/PercentInput';
import { toChargeTypeFormValues, toChargeTypeInput, type ChargeTypeFormValues } from '../helpers';
import type { ChargeType } from '../types';

interface ChargeTypeFormProps {
  type?: ChargeType;
  onSubmit: (values: CreateChargeTypeInput) => Promise<void> | void;
  isPending: boolean;
}

export function ChargeTypeForm({ type, onSubmit, isPending }: ChargeTypeFormProps) {
  const { t } = useTranslation('chargeTypes');
  const [form] = Form.useForm<ChargeTypeFormValues>();
  const kind = Form.useWatch('kind', form) ?? type?.kind ?? 'fixed';

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={toChargeTypeFormValues(type)}
      onFinish={(values) => onSubmit(toChargeTypeInput(values))}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={<FieldLabel title={t('form.name')} required />}
        rules={[{ required: true, whitespace: true, message: t('validation.nameRequired') }]}
      >
        <Input maxLength={60} placeholder={t('form.namePlaceholder')} />
      </Form.Item>

      <Form.Item name="kind" label={<FieldLabel title={t('form.kind')} required />}>
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={CHARGE_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
        />
      </Form.Item>

      {kind === 'percent' ? (
        <Form.Item
          name="percentValue"
          label={
            <FieldLabel
              title={t('form.percentValue')}
              caption={t('form.percentValueCaption')}
              required
            />
          }
          rules={[
            {
              type: 'number',
              required: true,
              min: 0.00001,
              max: 1,
              message: t('validation.percentInvalid'),
            },
          ]}
        >
          <PercentInput className="w-full" min={0.001} precision={3} step={0.5} />
        </Form.Item>
      ) : (
        <Form.Item
          name="fixedValue"
          label={<FieldLabel title={t('form.fixedValue')} required />}
          rules={[
            { type: 'number', required: true, min: 0, message: t('validation.fixedInvalid') },
          ]}
        >
          <MoneyInput className="w-full" min={0} />
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
