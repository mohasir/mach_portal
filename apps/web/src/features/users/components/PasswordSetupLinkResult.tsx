'use client';
import { App, Button, Typography } from 'antd';
import { Link2, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copyToClipboard } from '@/lib/utils/clipboard';

interface PasswordSetupLinkResultProps {
  url: string;
  name: string;
  email: string;
  variant: 'create' | 'reset';
}

export function PasswordSetupLinkResult({
  url,
  name,
  email,
  variant,
}: PasswordSetupLinkResultProps) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { message } = App.useApp();

  const shareText = t(`passwordSetupLink.${variant}.message`, { name, email, url });

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) message.success(t('passwordSetupLink.copied'));
  };

  const handleShare = async () => {
    // Same fallback ShareButton uses: the native sheet already lists whatever apps are
    // installed (WhatsApp, Instagram, etc), no need for per-network buttons.
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, title: t(`passwordSetupLink.${variant}.title`) });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    const ok = await copyToClipboard(shareText);
    if (ok) message.success(t('passwordSetupLink.copied'));
  };

  return (
    <div className="flex flex-col gap-8 mt-6">
      <div>
        <Typography.Title level={4} className="text-brown mb-2">
          {t(`passwordSetupLink.${variant}.title`)}
        </Typography.Title>

        <Typography.Text type="secondary">
          {t(`passwordSetupLink.${variant}.description`)}
        </Typography.Text>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <Button type="primary" icon={<Link2 size={16} />} block onClick={() => void handleCopy()}>
            {t('passwordSetupLink.copyLink')}
          </Button>
        </div>

        <div>
          <Button icon={<Share2 size={16} />} block onClick={() => void handleShare()}>
            {tc('share.action')}
          </Button>
        </div>
      </div>

      <div>
        <Typography.Text type="secondary" className="mt-2 block text-xs">
          {t('passwordSetupLink.expiryNotice')}
        </Typography.Text>
      </div>
    </div>
  );
}
