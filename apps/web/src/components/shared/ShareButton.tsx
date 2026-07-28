'use client';
import { useState } from 'react';
import { Button, Input, Popover } from 'antd';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { copyToClipboard } from '@/lib/utils/clipboard';

interface ShareButtonProps {
  url: string;
  title?: string;
  iconOnly?: boolean;
  size?: 'small' | 'middle';
  className?: string;
}

export function ShareButton({
  url,
  title,
  iconOnly,
  size = 'middle',
  className,
}: ShareButtonProps) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false);
      setCopied(false);
      return;
    }
    void (async () => {
      if (navigator.share) {
        try {
          await navigator.share({ url, title });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      setOpen(true);
    })();
  };

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottom"
      content={
        <div className="flex w-[min(20rem,80vw)] items-center gap-2">
          <Input
            readOnly
            size="small"
            className="min-w-0"
            prefix={<Link2 size={14} className="text-gray-400" />}
            value={url}
            onFocus={(e) => e.target.select()}
          />
          <Button
            size="small"
            type={copied ? undefined : 'primary'}
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <span className="flex items-center gap-1 text-green-600">
                <Check size={14} />
                {t('share.copied')}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Copy size={14} />
                {t('share.copy')}
              </span>
            )}
          </Button>
        </div>
      }
    >
      <Button size={size} icon={<Share2 size={iconOnly ? 14 : 16} />} className={className}>
        {!iconOnly && t('share.action')}
      </Button>
    </Popover>
  );
}
