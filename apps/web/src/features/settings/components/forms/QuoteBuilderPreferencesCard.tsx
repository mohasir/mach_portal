'use client';
import { Button, Flex, Form, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdateQuoteBuilderPreferences } from '../../hooks/useUpdateQuoteBuilderPreferences';
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
        <Flex justify="space-between" align="start" gap={16}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
            <span>{t('preferences.quoteBuilder.allowSelectOptionsAtQuote')}</span>
            <span className="text-gray-500 text-xs font-normal">
              {t('preferences.quoteBuilder.allowSelectOptionsAtQuoteCaption')}
            </span>
          </span>
          <Form.Item name="allowSelectOptionsAtQuote" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </Flex>

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
