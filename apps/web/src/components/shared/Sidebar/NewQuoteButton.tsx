'use client';
import { Button } from 'antd';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { useCan } from '@/lib/auth/useCan';

interface NewQuoteButtonProps {
  onNavigate?: () => void;
}

export function NewQuoteButton({ onNavigate }: NewQuoteButtonProps) {
  const { t } = useTranslation('admin');
  const can = useCan();
  const router = useRouter();
  const canCreateQuote = can({ [RESOURCES.QUOTE]: [ACTIONS.CREATE] });

  if (!canCreateQuote) return null;

  return (
    <div className="px-1 py-2">
      <Button
        type="primary"
        block
        icon={<Plus size={16} />}
        onClick={() => {
          router.push('/admin/quotes/new');
          onNavigate?.();
        }}
      >
        {t('nav.newQuote')}
      </Button>
    </div>
  );
}
