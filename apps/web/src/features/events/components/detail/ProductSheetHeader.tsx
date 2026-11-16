'use client';
import { Typography } from 'antd';
import type { Product } from '@/features/catalog';
import { getStationIcon } from '@/features/quotes';
import { formatQuantity } from '@/lib/format/quantity';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';

interface ProductSheetHeaderProps {
  product: Product;
  quantity: number;
  subtotal: number;
}

export function ProductSheetHeader({ product, quantity, subtotal }: ProductSheetHeaderProps) {
  const { money } = useMoneyFormatter();
  const Icon = getStationIcon(product.name);

  return (
    <div className="flex items-center gap-3">
      <div className="bg-mist text-navy flex size-20 shrink-0 items-center justify-center rounded-2xl">
        <Icon size={40} />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Typography.Text strong className="truncate text-lg">
          {product.name}
        </Typography.Text>
        <div className="flex flex-col mt-1">
          <span className="text-sm text-gray-500">{formatQuantity(quantity, product.unit)}</span>
          <span className="text-lg font-semibold">{money(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
