'use client';
import { useState } from 'react';
import { App, Button, Form, Select, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  LOCALES,
  localeSchema,
  TIME_FORMATS,
  type AppLocale,
  type TimeFormat,
} from '@repo/schemas';
import { FieldRow } from '@/components/shared/Inputs/FieldRow';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { WrapperSpin } from '@/components/shared/WrapperSpin';
import i18n from '@/lib/i18n/config';
import { useIsFormUnchanged } from '@/lib/hooks/useIsFormUnchanged';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { useUpdateUserPreferences, useUserPreferences } from '../../hooks/useUserPreferences';

// Translations are bundled, so switching is near-instant; a floor keeps the full-screen overlay
// from reading as a flicker.
const MIN_LOCALE_SWITCH_MS = 400;

interface UserPreferencesFormValues {
  locale: AppLocale;
  timeFormat: TimeFormat;
}

export function UserPreferencesCard() {
  const { t } = useTranslation('settings');
  const { message } = App.useApp();
  const { data, isLoading } = useUserPreferences();
  const { updateUserPreferences, isPending } = useUpdateUserPreferences();
  const currentLocale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [form] = Form.useForm<UserPreferencesFormValues>();
  const [switchingLocale, setSwitchingLocale] = useState(false);

  const initialValues: UserPreferencesFormValues | undefined = data
    ? {
        locale: data.locale ?? localeSchema.catch('es').parse(currentLocale),
        timeFormat: data.timeFormat,
      }
    : undefined;
  const unchanged = useIsFormUnchanged(form, initialValues);

  if (isLoading || !initialValues) return <Skeleton active paragraph={{ rows: 3 }} />;

  const onFinish = async (values: UserPreferencesFormValues) => {
    const localeChanged = values.locale !== currentLocale;
    if (localeChanged) setSwitchingLocale(true);
    try {
      await updateUserPreferences(values);
      if (localeChanged) {
        await Promise.all([
          i18n.changeLanguage(values.locale),
          new Promise((resolve) => setTimeout(resolve, MIN_LOCALE_SWITCH_MS)),
        ]);
        setLocale(values.locale);
      }
    } catch {
      return;
    } finally {
      setSwitchingLocale(false);
    }
    message.success(t('saveSuccess'));
  };

  return (
    <WrapperCard title={t('userPreferences.cardTitle')}>
      <WrapperSpin spinning={switchingLocale} />
      <Form
        key={JSON.stringify(initialValues)}
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={onFinish}
      >
        <FieldRow
          title={t('userPreferences.language')}
          caption={t('userPreferences.languageCaption')}
        >
          <Form.Item name="locale" className="mb-0">
            <Select
              className="w-full"
              options={LOCALES.map((value) => ({
                value,
                label: t(`userPreferences.languages.${value}`),
              }))}
            />
          </Form.Item>
        </FieldRow>

        <FieldRow
          title={t('userPreferences.timeFormat')}
          caption={t('userPreferences.timeFormatCaption')}
        >
          <Form.Item name="timeFormat" className="mb-0">
            <Select
              className="w-full"
              options={TIME_FORMATS.map((value) => ({
                value,
                label: t(`userPreferences.timeFormats.${value}`),
              }))}
            />
          </Form.Item>
        </FieldRow>

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
    </WrapperCard>
  );
}
