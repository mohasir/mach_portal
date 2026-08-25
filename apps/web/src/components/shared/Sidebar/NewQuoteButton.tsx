'use client';
import { Button, Tooltip } from 'antd';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';

interface NewQuoteButtonProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function NewQuoteButton({ collapsed = false, onNavigate }: NewQuoteButtonProps) {
  const { t } = useTranslation('admin');
  const can = useCan();
  const router = useRouter();
  const canCreateQuote = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });

  if (!canCreateQuote) return null;

  const onClick = () => {
    router.push('/admin/quotes/new');
    onNavigate?.();
  };

  if (collapsed) {
    return (
      <div className="flex justify-center px-1 py-2">
        <Tooltip title={t('nav.newQuote')} placement="right">
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={onClick}
            aria-label={t('nav.newQuote')}
          />
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-1 py-2">
      <Button type="primary" block icon={<Plus size={16} />} onClick={onClick}>
        {t('nav.newQuote')}
      </Button>
    </div>
  );
}
