'use client';
import { Typography } from 'antd';
import { ProductThumb, type Product } from '@/features/catalog';
import { formatQuantity, type QuantityUnit } from '@/lib/format/quantity';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';

interface ProductSheetHeaderProps {
  product: Product;
  quantity: number;
  unit: QuantityUnit;
  subtotal: number;
}

export function ProductSheetHeader({ product, quantity, unit, subtotal }: ProductSheetHeaderProps) {
  const { money } = useMoneyFormatter();

  return (
    <div className="flex items-center gap-3">
      <ProductThumb product={product} size="xl" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <Typography.Text strong className="truncate text-lg">
          {product.name}
        </Typography.Text>
        <div className="flex flex-col mt-1">
          <span className="text-sm text-gray-500">{formatQuantity(quantity, unit)}</span>
          <span className="text-lg font-semibold">{money(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
