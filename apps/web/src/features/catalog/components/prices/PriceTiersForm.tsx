'use client';
import { Button, Form, InputNumber, Space, Typography } from 'antd';
import { Plus } from 'lucide-react';
import { TbTrashFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { useCan } from '@/lib/auth/useCan';
import { useUpdatePriceTiers } from '../../hooks/usePrices';
import type { Product } from '../../types';

interface TierFormValue {
  numPersons: number;
  price: number;
}

interface PriceTiersFormValues {
  tiers: TierFormValue[];
}

interface PriceTiersFormProps {
  product: Product;
}

export function PriceTiersForm({ product }: PriceTiersFormProps) {
  const { t } = useTranslation('catalog');
  const can = useCan();
  const canCreate = can({ [RESOURCES.PRICE_TIERS]: [ACTIONS.CREATE] });
  const canEdit = can({ [RESOURCES.PRICE_TIERS]: [ACTIONS.UPDATE] });
  const canDelete = can({ [RESOURCES.PRICE_TIERS]: [ACTIONS.DELETE] });
  const { updateTiers, isPending } = useUpdatePriceTiers();
  const [form] = Form.useForm<PriceTiersFormValues>();
  const [confirm, confirmContextHolder] = useActionConfirm();

  const handleFinish = async (values: PriceTiersFormValues) => {
    const tiers = [...values.tiers].sort((a, b) => a.numPersons - b.numPersons);
    await updateTiers(product.id, { tiers });
    form.setFieldsValue({ tiers });
  };

  const handleRemove = (fieldName: number, remove: (name: number) => void) => {
    const tier = form.getFieldValue(['tiers', fieldName]) as TierFormValue | undefined;
    const hasData = tier?.numPersons != null || tier?.price != null;
    if (!hasData) {
      remove(fieldName);
      return;
    }
    confirm({
      title: t('prices.removeTierConfirm.title'),
      content: t('prices.removeTierConfirm.content'),
      danger: true,
      onOk: () => remove(fieldName),
    });
  };

  return (
    <div>
      <Typography.Text type="secondary" className="block text-sm mb-4">
        {t('prices.tabDescription')}
      </Typography.Text>

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
        className="flex flex-col gap-6"
      >
        <Form.List name="tiers">
          {(fields, { add, remove }) => (
            <div className="mb-2 flex flex-col gap-2">
              {canCreate && (
                <button
                  type="button"
                  onClick={() => add()}
                  className="border-line flex w-full items-center justify-center gap-2 rounded-xl border border-dashed text-gray-400 my-6 h-11.5"
                >
                  <Plus size={16} />
                  <span className="text-base">{t('prices.addTier')}</span>
                </button>
              )}
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
                  {canDelete && (
                    <Button
                      type="text"
                      danger
                      shape="square"
                      aria-label={t('prices.removeTier')}
                      icon={
                        <IconBadge
                          icon={TbTrashFilled}
                          shape="square"
                          className="bg-salmon/20 text-error"
                        />
                      }
                      onClick={() => handleRemove(field.name, remove)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </Form.List>

        {canEdit && (
          <div>
            <Form.Item className="mb-0">
              <Button type="primary" block htmlType="submit" loading={isPending}>
                {t('form.save')}
              </Button>
            </Form.Item>
            <WrapperAlert
              type="info"
              description={t('prices.autoSortNote')}
              closeable={false}
              className="mt-4"
            />
          </div>
        )}
      </Form>

      {confirmContextHolder}
    </div>
  );
}
