'use client';
import { Button, Divider, Form, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import type { QuotePdfTemplateContent, ServiceInfo } from '@repo/schemas';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useQuotePdfTemplate } from '../../hooks/useQuotePdfTemplate';
import { useUpdateQuotePdfTemplate } from '../../hooks/useUpdateQuotePdfTemplate';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { TermsAndConditionsEditor } from './TermsAndConditionsEditor';
import { ServiceDurationsEditor } from './ServiceDurationsEditor';
import { NoteCardEditor } from './NoteCardEditor';

interface QuotePdfTemplateFormValues {
  termsAndConditions: string[];
  validityNote?: string;
  dietaryNote?: string;
  services: ServiceInfo[];
}

const toFormValues = (content: QuotePdfTemplateContent): QuotePdfTemplateFormValues => ({
  termsAndConditions: content.termsAndConditions,
  validityNote: content.validityNote,
  dietaryNote: content.dietaryNote,
  services: content.services,
});

const toContent = (values: QuotePdfTemplateFormValues): QuotePdfTemplateContent => ({
  termsAndConditions: values.termsAndConditions,
  validityNote: values.validityNote,
  dietaryNote: values.dietaryNote,
  services: values.services,
});

export function QuotePdfTemplateForm() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading } = useQuotePdfTemplate();
  const { updateQuotePdfTemplate, isPending } = useUpdateQuotePdfTemplate();
  const [form] = Form.useForm<QuotePdfTemplateFormValues>();
  const unchanged = useIsFormUnchanged(form, data ? toFormValues(data.content) : undefined);

  if (!can({ [RESOURCES.QUOTE_PDF_TEMPLATE]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  const canEdit = can({ [RESOURCES.QUOTE_PDF_TEMPLATE]: [ACTIONS.UPDATE] });
  const onFinish = (values: QuotePdfTemplateFormValues) =>
    void updateQuotePdfTemplate(toContent(values));

  return (
    <Form
      key={String(data.updatedAt)}
      form={form}
      layout="vertical"
      initialValues={toFormValues(data.content)}
      onFinish={onFinish}
      disabled={!canEdit}
    >
      <Form.Item
        name="services"
        label={
          <FieldLabel
            title={t('quotePdfTemplate.services')}
            caption={t('quotePdfTemplate.servicesCaption')}
          />
        }
        className="mb-0"
      >
        <ServiceDurationsEditor disabled={!canEdit} />
      </Form.Item>

      <Divider className="my-6" />

      <Form.Item
        name="termsAndConditions"
        label={
          <FieldLabel
            title={t('quotePdfTemplate.termsAndConditions')}
            caption={t('quotePdfTemplate.termsAndConditionsCaption')}
          />
        }
        className="mb-0"
      >
        <TermsAndConditionsEditor disabled={!canEdit} />
      </Form.Item>

      <Divider className="my-6" />

      <Form.Item
        name="validityNote"
        label={
          <FieldLabel
            title={t('quotePdfTemplate.validityNote')}
            caption={t('quotePdfTemplate.validityNoteCaption')}
          />
        }
        className="mb-0"
      >
        <NoteCardEditor
          disabled={!canEdit}
          maxLength={300}
          addLabel={t('quotePdfTemplate.addValidityNote')}
          removeLabel={t('quotePdfTemplate.removeValidityNote')}
          removeConfirmTitle={t('quotePdfTemplate.removeValidityNoteConfirm.title')}
          removeConfirmContent={t('quotePdfTemplate.removeValidityNoteConfirm.content')}
        />
      </Form.Item>

      <Divider className="my-6" />

      <Form.Item
        name="dietaryNote"
        label={
          <FieldLabel
            title={t('quotePdfTemplate.dietaryNote')}
            caption={t('quotePdfTemplate.dietaryNoteCaption')}
          />
        }
        className="mb-0"
      >
        <NoteCardEditor
          disabled={!canEdit}
          maxLength={300}
          addLabel={t('quotePdfTemplate.addDietaryNote')}
          removeLabel={t('quotePdfTemplate.removeDietaryNote')}
          removeConfirmTitle={t('quotePdfTemplate.removeDietaryNoteConfirm.title')}
          removeConfirmContent={t('quotePdfTemplate.removeDietaryNoteConfirm.content')}
        />
      </Form.Item>

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
