'use client';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Copy } from '@/components/shared/Copy';
import { env } from '@/env';

export function AboutSettingsForm() {
  const { t: tCommon } = useTranslation('common');
  const { t } = useTranslation('settings');

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-between py-6 pt-10 text-center">
      <div className="flex flex-col items-center gap-2">
        <Typography.Title level={2} className="font-heading text-brown m-0!">
          {tCommon('appName')}
        </Typography.Title>
        <Typography.Text className="text-muted max-w-xs text-sm">
          {t('about.description')}
        </Typography.Text>
        <Typography.Text className="text-muted mt-4 text-xs">
          {t('about.version', { version: env.NEXT_PUBLIC_APP_VERSION })}
        </Typography.Text>
      </div>

      <Copy />
    </div>
  );
}
