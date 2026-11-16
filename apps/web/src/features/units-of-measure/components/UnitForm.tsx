'use client';
import { Button, Col, Form, Input, Row, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { isPositiveDecimal, UOM_DIMENSIONS, type CreateUnitInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { baseCodeOf, unitFieldLocks } from '../helpers';
import type { UnitOfMeasure } from '../types';

interface UnitFormProps {
  unit?: UnitOfMeasure;
  onSubmit: (values: CreateUnitInput) => Promise<void> | void;
  isPending: boolean;
}

export function UnitForm({ unit, onSubmit, isPending }: UnitFormProps) {
  const { t } = useTranslation('unitsOfMeasure');
  const [form] = Form.useForm<CreateUnitInput>();
  const dimension = Form.useWatch('dimension', form) ?? unit?.dimension ?? 'quantity';
  const locks = unitFieldLocks(unit);
  const lockNotice = unit?.isSystem
    ? t('form.systemLocked')
    : locks.dimension
      ? t('form.usedLocked')
      : null;

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={
        unit
          ? {
              name: unit.name,
              pluralName: unit.pluralName,
              code: unit.code,
              dimension: unit.dimension,
              factor: unit.factor,
            }
          : { dimension: 'quantity' }
      }
      onFinish={onSubmit}
      requiredMark={false}
    >
      {lockNotice && (
        <WrapperAlert type="info" showIcon className="mb-4" description={lockNotice} />
      )}

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="name"
            label={<FieldLabel title={t('form.name')} required />}
            rules={[{ required: true, whitespace: true, message: t('validation.nameRequired') }]}
          >
            <Input maxLength={60} placeholder={t('form.namePlaceholder')} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="pluralName"
            label={<FieldLabel title={t('form.pluralName')} required />}
            rules={[
              { required: true, whitespace: true, message: t('validation.pluralNameRequired') },
            ]}
          >
            <Input maxLength={60} placeholder={t('form.pluralNamePlaceholder')} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="code"
            label={<FieldLabel title={t('form.code')} required />}
            rules={[{ required: true, whitespace: true, message: t('validation.codeRequired') }]}
          >
            <Input maxLength={12} disabled={locks.code} placeholder={t('form.codePlaceholder')} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="dimension"
            label={<FieldLabel title={t('form.dimension')} required />}
            rules={[{ required: true, message: t('validation.dimensionRequired') }]}
          >
            <Select
              disabled={locks.dimension}
              options={UOM_DIMENSIONS.map((value) => ({
                value,
                label: t(`dimensions.${value}`),
              }))}
            />
          </Form.Item>
        </Col>
      </Row>

      {!unit?.isBase && (
        <Form.Item
          name="factor"
          label={
            <FieldLabel
              title={t('form.factor')}
              caption={t('form.factorCaption', { base: baseCodeOf(dimension) })}
              required
            />
          }
          rules={[
            {
              validator: (_, value?: string) =>
                value && isPositiveDecimal(value.trim())
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('validation.factorInvalid'))),
            },
          ]}
        >
          <Input
            inputMode="decimal"
            disabled={locks.factor}
            suffix={baseCodeOf(dimension)}
            placeholder="1"
          />
        </Form.Item>
      )}
      {/* A base unit keeps factor 1; the hidden field still sends it. */}
      {unit?.isBase && (
        <Form.Item name="factor" hidden>
          <Input />
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
