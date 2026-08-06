'use client';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { getStationIcon } from '@/features/quotes';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';

interface StationSheetHeaderProps {
  product: Product;
  numPersons: number;
  subtotal: number;
}

export function StationSheetHeader({ product, numPersons, subtotal }: StationSheetHeaderProps) {
  const { t } = useTranslation('quotes');
  const { money } = useMoneyFormatter();
  const Icon = getStationIcon(product.name);

  return (
    <div className="flex items-center gap-3">
      <div className="bg-olive-faint text-brown flex size-20 shrink-0 items-center justify-center rounded-2xl">
        <Icon size={40} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Typography.Text strong className="truncate text-lg">
          {product.name}
        </Typography.Text>
        <div className="flex flex-col mt-1">
          <span className="text-sm text-gray-500">
            {t('builder.lines.numPersonsCount', { count: numPersons })}
          </span>
          <span className="text-lg font-semibold">{money(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
