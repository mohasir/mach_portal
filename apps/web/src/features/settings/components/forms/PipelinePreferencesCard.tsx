'use client';
import { Button, Form, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdatePipelinePreferences } from '../../hooks/useUpdatePipelinePreferences';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface PipelinePreferencesFormValues {
  hideStaleQuotes: boolean;
}

export function PipelinePreferencesCard() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updatePipelinePreferences, isPending } = useUpdatePipelinePreferences();
  const [form] = Form.useForm<PipelinePreferencesFormValues>();
  const unchanged = useIsFormUnchanged(
    form,
    data ? { hideStaleQuotes: data.appSettings.hideStaleQuotes } : undefined,
  );

  if (!can({ [RESOURCES.PIPELINE_PREFERENCES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 2 }} />;

  const canEdit = can({ [RESOURCES.PIPELINE_PREFERENCES]: [ACTIONS.UPDATE] });
  const onFinish = (values: PipelinePreferencesFormValues) => {
    void updatePipelinePreferences({ hideStaleQuotes: values.hideStaleQuotes });
  };

  return (
    <WrapperCard title={t('preferences.pipeline.title')}>
      <Form
        key={String(data.appSettings.updatedAt)}
        form={form}
        layout="vertical"
        initialValues={{ hideStaleQuotes: data.appSettings.hideStaleQuotes }}
        onFinish={onFinish}
        disabled={!canEdit}
      >
        <SwitchRow
          title={t('preferences.pipeline.hideStaleQuotes')}
          caption={t('preferences.pipeline.hideStaleQuotesCaption')}
          control={
            <Form.Item name="hideStaleQuotes" valuePropName="checked" noStyle>
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
