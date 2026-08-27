'use client';
import { useProductMutations } from '../hooks/useProductMutations';
import { SortableList } from './SortableList';
import { ProductPanel } from './ProductPanel';
import type { Product } from '../types';

interface ProductListProps {
  products: Product[];
}

export function ProductList({ products }: ProductListProps) {
  const { reorderProducts } = useProductMutations();
  const ids = products.map((p) => p.id);

  return (
    <SortableList ids={ids} onReorder={reorderProducts}>
      <div className="flex flex-col gap-3">
        {products.map((product) => (
          <ProductPanel key={product.id} product={product} />
        ))}
      </div>
    </SortableList>
  );
}
