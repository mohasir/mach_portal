'use client';
import { PricePanel } from './PricePanel';
import type { PriceItem } from '../../types';

interface PriceListProps {
  products: PriceItem[];
  canEdit: boolean;
}

export function PriceList({ products, canEdit }: PriceListProps) {
  return (
    <div className="flex flex-col gap-3">
      {products.map((product) => (
        <PricePanel key={product.id} product={product} canEdit={canEdit} />
      ))}
    </div>
  );
}
