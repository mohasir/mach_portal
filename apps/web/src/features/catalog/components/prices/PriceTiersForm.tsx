'use client';
import { Button, Form, InputNumber, Space } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { useUpdatePriceTiers } from '../../hooks/usePrices';
import type { PriceItem } from '../../types';

interface TierFormValue {
  numPersons: number;
  price: number;
}

interface PriceTiersFormValues {
  tiers: TierFormValue[];
}

interface PriceTiersFormProps {
  product: PriceItem;
  canEdit: boolean;
}

export function PriceTiersForm({ product, canEdit }: PriceTiersFormProps) {
  const { t } = useTranslation('catalog');
  const { updateTiers, isPending } = useUpdatePriceTiers();
  const [form] = Form.useForm<PriceTiersFormValues>();

  const handleFinish = (values: PriceTiersFormValues) =>
    updateTiers(product.id, {
      tiers: [...values.tiers].sort((a, b) => a.numPersons - b.numPersons),
    });

  return (
    <Form
      form={form}
      layout="vertical"
      disabled={!canEdit}
      initialValues={{
        tiers: product.priceTiers.map((tier) => ({
          numPersons: tier.numPersons,
          price: tier.price,
        })),
      }}
      onFinish={handleFinish}
      requiredMark={false}
    >
      <Form.List name="tiers">
        {(fields, { add, remove }) => (
          <div className="mb-2 flex flex-col gap-2">
            {fields.map((field) => (
              <div key={field.key} className="flex items-start gap-2">
                <Space.Compact className="mb-0 flex-1">
                  <Space.Addon>{t('prices.numPersonsShort')}</Space.Addon>
                  <Form.Item
                    name={[field.name, 'numPersons']}
                    noStyle
                    rules={[{ required: true, message: t('validation.numPersonsInvalid') }]}
                  >
                    <InputNumber min={1} step={10} precision={0} className="w-full" />
                  </Form.Item>
                </Space.Compact>
                <Form.Item
                  name={[field.name, 'price']}
                  className="mb-0 flex-1"
                  rules={[{ required: true, message: t('validation.priceInvalid') }]}
                >
                  <MoneyInput min={0} step={5} className="w-full" placeholder="0.00" />
                </Form.Item>
                <Button
                  type="text"
                  aria-label={t('prices.removeTier')}
                  icon={<Trash2 size={16} />}
                  onClick={() => remove(field.name)}
                />
              </div>
            ))}
            <Button type="dashed" onClick={() => add()} icon={<Plus size={16} />} block>
              {t('prices.addTier')}
            </Button>
          </div>
        )}
      </Form.List>

      {canEdit && (
        <Form.Item className="mb-0">
          <Button type="primary" htmlType="submit" loading={isPending}>
            {t('form.save')}
          </Button>
        </Form.Item>
      )}
    </Form>
  );
}
