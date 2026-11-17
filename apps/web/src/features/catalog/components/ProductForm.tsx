'use client';
import type { ComponentProps } from 'react';
import { Col, Form, Input, InputNumber, Row, Switch, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { ACTIONS, RESOURCES } from '@repo/guards';
import {
  LONG_DESCRIPTION_MAX,
  SHORT_DESCRIPTION_MAX,
  SKU_MAX,
  type PriceTierInput,
} from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import { CategorySelect } from '@/features/product-categories';
import { UnitSelect, useUnitOptions } from '@/features/units-of-measure';
import { useCan } from '@/lib/auth/useCan';
import { useFeature } from '@/lib/auth/useFeature';
import { maxLengthValidator } from '@/lib/format/markdown';
import {
  buildProductPayload,
  costFieldMode,
  type ProductFormValues,
  type ProductPayload,
} from '../helpers';

interface ProductFormProps {
  form: FormInstance<ProductFormValues>;
  initialValues?: Partial<ProductFormValues>;
  /** The product's unit when editing, offered even if it was deactivated later. */
  currentUnit?: ComponentProps<typeof UnitSelect>['current'];
  /** Quotes already count this product in its unit, so the unit stays as it is. */
  unitLocked?: boolean;
  /** The product's category when editing, offered even if it was deactivated later. */
  currentCategory?: ComponentProps<typeof CategorySelect>['current'];
  tiers?: PriceTierInput[];
  onSubmit: (values: ProductPayload) => Promise<void> | void;
}

export function ProductForm({
  form,
  initialValues,
  currentUnit,
  unitLocked = false,
  currentCategory,
  tiers = [],
  onSubmit,
}: ProductFormProps) {
  const { t } = useTranslation('catalog');
  const vocabulary = useCatalogVocabulary();
  const priceTiersEnabled = useFeature('priceTiers');
  const can = useCan();
  const costMode = costFieldMode({
    canRead: can({ [RESOURCES.PRODUCT_COST]: [ACTIONS.READ] }),
    canUpdate: can({ [RESOURCES.PRODUCT_COST]: [ACTIONS.UPDATE] }),
  });
  const { data: units = [] } = useUnitOptions();
  const uomId = Form.useWatch('uomId', form) ?? initialValues?.uomId;
  const unit =
    units.find((u) => u.id === uomId) ?? (currentUnit?.id === uomId ? currentUnit : undefined);

  const handleFinish = (values: ProductFormValues) =>
    onSubmit(buildProductPayload(values, { tiers, priceTiersEnabled, costMode }));

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ isPremium: false, minQuantity: 1, ...initialValues }}
      onFinish={handleFinish}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={<FieldLabel title={t('product.form.name')} required />}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('product.form.namePlaceholder', vocabulary)} />
      </Form.Item>

      <Form.Item
        name="shortDescription"
        label={<FieldLabel title={t('product.form.shortDescription')} />}
        rules={[
          {
            validator: maxLengthValidator(
              SHORT_DESCRIPTION_MAX,
              t('validation.shortDescriptionTooLong', { max: SHORT_DESCRIPTION_MAX }),
            ),
          },
        ]}
      >
        <RichTextEditor
          maxLength={SHORT_DESCRIPTION_MAX}
          aria-label={t('product.form.shortDescription')}
          placeholder={t('product.form.shortDescriptionPlaceholder')}
        />
      </Form.Item>

      <Form.Item
        name="longDescription"
        label={<FieldLabel title={t('product.form.longDescription')} />}
        rules={[
          {
            validator: maxLengthValidator(
              LONG_DESCRIPTION_MAX,
              t('validation.longDescriptionTooLong', { max: LONG_DESCRIPTION_MAX }),
            ),
          },
        ]}
      >
        <RichTextEditor
          size="tall"
          maxLength={LONG_DESCRIPTION_MAX}
          aria-label={t('product.form.longDescription')}
          placeholder={t('product.form.longDescriptionPlaceholder', vocabulary)}
        />
      </Form.Item>

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="sku"
            label={<FieldLabel title={t('product.form.sku')} />}
            rules={[{ max: SKU_MAX, message: t('validation.skuInvalid') }]}
          >
            <Input maxLength={SKU_MAX} placeholder={t('product.form.skuPlaceholder')} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item name="categoryId" label={<FieldLabel title={t('product.form.category')} />}>
            <CategorySelect
              current={currentCategory}
              placeholder={t('product.form.categoryPlaceholder')}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="uomId"
        label={<FieldLabel title={t('product.form.unit')} required />}
        extra={t(unitLocked ? 'product.form.unitLocked' : 'product.form.unitCaption', vocabulary)}
        rules={[{ required: true, message: t('validation.unitRequired') }]}
      >
        <UnitSelect
          current={currentUnit}
          disabled={unitLocked}
          placeholder={t('product.form.unitPlaceholder')}
        />
      </Form.Item>

      <Form.Item
        name="minQuantity"
        label={<FieldLabel title={t('product.form.minQuantity')} required />}
        extra={t('product.form.minQuantityCaption', vocabulary)}
        rules={[
          { required: true, message: t('validation.minQuantityInvalid') },
          { type: 'number', min: 1, message: t('validation.minQuantityInvalid') },
        ]}
      >
        <InputNumber min={1} precision={0} className="w-full" suffix={unit?.code} />
      </Form.Item>

      <Row gutter={12}>
        <Col xs={24} sm={costMode === 'hidden' ? 24 : 12}>
          <Form.Item
            name="price"
            label={<FieldLabel title={t('product.form.price')} />}
            extra={t('product.form.priceCaption', vocabulary)}
            rules={[{ type: 'number', min: 0, message: t('validation.priceInvalid') }]}
          >
            <MoneyInput min={0} step={5} className="w-full" placeholder="0.00" />
          </Form.Item>
        </Col>
        {costMode !== 'hidden' && (
          <Col xs={24} sm={12}>
            <Form.Item
              name="cost"
              label={<FieldLabel title={t('product.form.cost')} />}
              extra={t('product.form.costCaption')}
              rules={[{ type: 'number', min: 0, message: t('validation.costInvalid') }]}
            >
              <MoneyInput
                min={0}
                step={5}
                className="w-full"
                placeholder="0.00"
                disabled={costMode === 'read'}
              />
            </Form.Item>
          </Col>
        )}
      </Row>

      <SwitchRow
        title={t('product.form.isPremium')}
        control={
          <Form.Item name="isPremium" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        }
      />
    </Form>
  );
}
