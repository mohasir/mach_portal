'use client';
import { Button, Form, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdateQuoteBuilderPreferences } from '../../hooks/useUpdateQuoteBuilderPreferences';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface QuoteBuilderPreferencesFormValues {
  allowSelectOptionsAtQuote: boolean;
}

export function QuoteBuilderPreferencesCard() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updateQuoteBuilderPreferences, isPending } = useUpdateQuoteBuilderPreferences();
  const [form] = Form.useForm<QuoteBuilderPreferencesFormValues>();
  const unchanged = useIsFormUnchanged(
    form,
    data ? { allowSelectOptionsAtQuote: data.appSettings.allowSelectOptionsAtQuote } : undefined,
  );

  if (!can({ [RESOURCES.QUOTE_BUILDER_PREFERENCES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 2 }} />;

  const canEdit = can({ [RESOURCES.QUOTE_BUILDER_PREFERENCES]: [ACTIONS.UPDATE] });
  const onFinish = (values: QuoteBuilderPreferencesFormValues) => {
    void updateQuoteBuilderPreferences({
      allowSelectOptionsAtQuote: values.allowSelectOptionsAtQuote,
    });
  };

  return (
    <WrapperCard title={t('preferences.quoteBuilder.title')}>
      <Form
        key={String(data.appSettings.updatedAt)}
        form={form}
        layout="vertical"
        initialValues={{ allowSelectOptionsAtQuote: data.appSettings.allowSelectOptionsAtQuote }}
        onFinish={onFinish}
        disabled={!canEdit}
      >
        <SwitchRow
          title={t('preferences.quoteBuilder.allowSelectOptionsAtQuote')}
          caption={t('preferences.quoteBuilder.allowSelectOptionsAtQuoteCaption')}
          control={
            <Form.Item name="allowSelectOptionsAtQuote" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          }
        />

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
    </WrapperCard>
  );
}
