'use client';
import { useProductMutations } from '../hooks/useProductMutations';
import { SortableList } from './SortableList';
import { ProductPanel } from './ProductPanel';
import type { Product } from '../types';

interface ProductListProps {
  products: Product[];
  onEdit: (product: Product) => void;
}

export function ProductList({ products, onEdit }: ProductListProps) {
  const { reorderProducts } = useProductMutations();
  const ids = products.map((p) => p.id);

  return (
    <SortableList ids={ids} onReorder={reorderProducts}>
      <div className="flex flex-col gap-3">
        {products.map((product) => (
          <ProductPanel key={product.id} product={product} onEdit={onEdit} />
        ))}
      </div>
    </SortableList>
  );
}
