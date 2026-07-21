'use client';
import { Button, Form, Input, Skeleton, Tag } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QuotePdfTemplateContent, ServiceInfo } from '@repo/schemas';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useQuotePdfTemplate } from '../hooks/useQuotePdfTemplate';
import { useUpdateQuotePdfTemplate } from '../hooks/useUpdateQuotePdfTemplate';
import { SettingsCard } from './SettingsCard';

interface QuotePdfTemplateFormValues {
  termsAndConditionsText: string;
  validityNote?: string;
  dietaryNote?: string;
  services: ServiceInfo[];
}

const parseTerms = (text: string): string[] =>
  text
    .split('\n')
    .map((term) => term.trim())
    .filter(Boolean);

const toFormValues = (content: QuotePdfTemplateContent): QuotePdfTemplateFormValues => ({
  termsAndConditionsText: content.termsAndConditions.join('\n'),
  validityNote: content.validityNote,
  dietaryNote: content.dietaryNote,
  services: content.services,
});

const toContent = (values: QuotePdfTemplateFormValues): QuotePdfTemplateContent => ({
  termsAndConditions: parseTerms(values.termsAndConditionsText),
  validityNote: values.validityNote,
  dietaryNote: values.dietaryNote,
  services: values.services,
});

export function QuotePdfTemplateForm() {
  const { t } = useTranslation('settings');
  const { data, isLoading } = useQuotePdfTemplate();
  const { updateQuotePdfTemplate, isPending } = useUpdateQuotePdfTemplate();
  const [form] = Form.useForm<QuotePdfTemplateFormValues>();
  const unchanged = useIsFormUnchanged(form, data ? toFormValues(data.content) : undefined);
  const termsPreview = parseTerms(Form.useWatch('termsAndConditionsText', form) ?? '');

  if (isLoading || !data) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  const onFinish = (values: QuotePdfTemplateFormValues) =>
    void updateQuotePdfTemplate(toContent(values));

  return (
    <Form
      key={String(data.updatedAt)}
      form={form}
      layout="vertical"
      initialValues={toFormValues(data.content)}
      onFinish={onFinish}
    >
      <SettingsCard title={t('quotePdfTemplate.title')} caption={t('quotePdfTemplate.caption')}>
        <Form.Item
          label={t('quotePdfTemplate.services')}
          tooltip={t('quotePdfTemplate.servicesCaption')}
        >
          <Form.List name="services">
            {(fields, { add, remove }) => (
              <div className="mb-2 flex flex-col gap-2">
                {fields.map((field) => (
                  <div key={field.key} className="flex items-start gap-2">
                    <Form.Item
                      name={[field.name, 'label']}
                      className="mb-0 flex-1"
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: t('validation.serviceLabelRequired'),
                        },
                      ]}
                    >
                      <Input
                        placeholder={t('quotePdfTemplate.serviceLabelPlaceholder')}
                        maxLength={100}
                      />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'duration']}
                      className="mb-0 flex-1"
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: t('validation.serviceDurationRequired'),
                        },
                      ]}
                    >
                      <Input
                        placeholder={t('quotePdfTemplate.serviceDurationPlaceholder')}
                        maxLength={200}
                      />
                    </Form.Item>
                    <Button
                      type="text"
                      aria-label={t('quotePdfTemplate.removeService')}
                      icon={<Trash2 size={16} />}
                      onClick={() => remove(field.name)}
                    />
                  </div>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ label: '', duration: '' })}
                  icon={<Plus size={16} />}
                  block
                >
                  {t('quotePdfTemplate.addService')}
                </Button>
              </div>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item
          name="termsAndConditionsText"
          label={t('quotePdfTemplate.termsAndConditions')}
          tooltip={t('quotePdfTemplate.termsAndConditionsCaption')}
          className={termsPreview.length > 0 ? 'mb-2' : undefined}
        >
          <Input.TextArea
            rows={4}
            placeholder={t('quotePdfTemplate.termsAndConditionsPlaceholder')}
          />
        </Form.Item>
        {termsPreview.length > 0 && (
          <div className="mb-5 flex flex-col items-start gap-1">
            {termsPreview.map((term, i) => (
              <Tag key={`${term}-${i}`} className="max-w-full whitespace-normal! wrap-break-word">
                {term}
              </Tag>
            ))}
          </div>
        )}

        <Form.Item
          name="validityNote"
          label={t('quotePdfTemplate.validityNote')}
          tooltip={t('quotePdfTemplate.validityNoteCaption')}
        >
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>

        <Form.Item
          name="dietaryNote"
          label={t('quotePdfTemplate.dietaryNote')}
          tooltip={t('quotePdfTemplate.dietaryNoteCaption')}
          className="mb-0"
        >
          <Input.TextArea rows={2} maxLength={300} showCount />
        </Form.Item>
      </SettingsCard>

      <Button
        type="primary"
        htmlType="submit"
        loading={isPending}
        disabled={unchanged}
        className="mt-6"
      >
        {t('save')}
      </Button>
    </Form>
  );
}
