'use client';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { SELECT_ORGANIZATION_ROUTE } from '@/lib/auth/navigation';

export function PlatformModeBanner({ name }: { name: string }) {
  const { t } = useTranslation('tenant');

  return (
    <div
      role="status"
      className="bg-blue text-sand flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-1.5 pt-[calc(env(safe-area-inset-top)+0.375rem)] text-xs font-medium"
    >
      <span className="flex items-center gap-1.5">
        <ShieldAlert size={14} className="shrink-0" />
        {t('platform.banner', { name })}
      </span>
      <Link href={SELECT_ORGANIZATION_ROUTE} className="text-navy underline">
        {t('platform.switch')}
      </Link>
    </div>
  );
}
