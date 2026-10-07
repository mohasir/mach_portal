'use client';
import { Button, Form, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useConfig } from '../../hooks/useConfig';
import { useUpdateReleaseNotesPreferences } from '../../hooks/useUpdateReleaseNotesPreferences';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface ReleaseNotesPreferencesFormValues {
  showReleaseNotes: boolean;
}

export function ReleaseNotesPreferencesCard() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading } = useConfig();
  const { updateReleaseNotesPreferences, isPending } = useUpdateReleaseNotesPreferences();
  const [form] = Form.useForm<ReleaseNotesPreferencesFormValues>();
  const unchanged = useIsFormUnchanged(
    form,
    data ? { showReleaseNotes: data.appSettings.showReleaseNotes } : undefined,
  );

  if (!can({ [RESOURCES.RELEASE_NOTES_PREFERENCES]: [ACTIONS.VIEW] })) return null;
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 2 }} />;

  const canEdit = can({ [RESOURCES.RELEASE_NOTES_PREFERENCES]: [ACTIONS.UPDATE] });
  const onFinish = (values: ReleaseNotesPreferencesFormValues) => {
    void updateReleaseNotesPreferences({ showReleaseNotes: values.showReleaseNotes });
  };

  return (
    <WrapperCard title={t('preferences.releaseNotes.title')}>
      <Form
        key={String(data.appSettings.updatedAt)}
        form={form}
        layout="vertical"
        initialValues={{ showReleaseNotes: data.appSettings.showReleaseNotes }}
        onFinish={onFinish}
        disabled={!canEdit}
      >
        <SwitchRow
          title={t('preferences.releaseNotes.showReleaseNotes')}
          caption={t('preferences.releaseNotes.showReleaseNotesCaption')}
          control={
            <Form.Item name="showReleaseNotes" valuePropName="checked" noStyle>
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
