'use client';
import { App, Alert, Button, Input } from 'antd';
import { Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copyToClipboard } from '@/lib/utils/clipboard';

export function SetupLinkResult({
  name,
  setupUrl,
  onOpen,
  onClose,
}: {
  name: string;
  setupUrl: string | null;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('console');
  const { message } = App.useApp();

  const copy = async () => {
    if (setupUrl && (await copyToClipboard(setupUrl))) message.success(t('setup.copied'));
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0">{t('setup.description', { name })}</p>

      {setupUrl ? (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor="setup-link" className="text-sm font-medium">
              {t('setup.linkLabel')}
            </label>
            <Input
              id="setup-link"
              readOnly
              value={setupUrl}
              onFocus={(event) => event.target.select()}
            />
            <Button icon={<Copy size={16} />} onClick={() => void copy()} block>
              {t('setup.copy')}
            </Button>
          </div>
          <Alert type="warning" showIcon title={t('setup.once')} />
        </>
      ) : (
        <Alert type="info" showIcon title={t('setup.noLink')} />
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onClose}>{t('setup.close')}</Button>
        <Button type="primary" onClick={onOpen}>
          {t('setup.open')}
        </Button>
      </div>
    </div>
  );
}
