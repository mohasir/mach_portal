'use client';
import { Button, Form, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { Feature } from '@/lib/auth/Feature';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { withStoredValues } from '../../helpers';
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
  const initialValues: QuoteBuilderPreferencesFormValues | undefined = data && {
    allowSelectOptionsAtQuote: data.appSettings.allowSelectOptionsAtQuote,
  };
  const unchanged = useIsFormUnchanged(form, initialValues);

  if (!can({ [RESOURCES.QUOTE_BUILDER_PREFERENCES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 2 }} />;

  const canEdit = can({ [RESOURCES.QUOTE_BUILDER_PREFERENCES]: [ACTIONS.UPDATE] });
  const onFinish = (values: QuoteBuilderPreferencesFormValues) => {
    void updateQuoteBuilderPreferences(withStoredValues(initialValues!, values));
  };

  return (
    <WrapperCard title={t('preferences.quoteBuilder.title')}>
      <Form
        key={String(data.appSettings.updatedAt)}
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={onFinish}
        disabled={!canEdit}
      >
        <Feature name="configurableOptions">
          <SwitchRow
            title={t('preferences.quoteBuilder.allowSelectOptionsAtQuote')}
            caption={t('preferences.quoteBuilder.allowSelectOptionsAtQuoteCaption')}
            control={
              <Form.Item name="allowSelectOptionsAtQuote" valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
            }
          />
        </Feature>

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
