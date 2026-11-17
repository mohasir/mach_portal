'use client';
import { mergeReorder } from '../helpers';
import { useProductMutations } from '../hooks/useProductMutations';
import { SortableList } from './SortableList';
import { ProductPanel } from './ProductPanel';
import type { Product } from '../types';

interface ProductListProps {
  products: Product[];
  /** Every product id in catalog order, when `products` is a filtered subset of it. */
  allIds?: string[];
}

export function ProductList({ products, allIds }: ProductListProps) {
  const { reorderProducts } = useProductMutations();
  const ids = products.map((p) => p.id);

  return (
    <SortableList
      ids={ids}
      onReorder={(next) => reorderProducts(allIds ? mergeReorder(allIds, next) : next)}
    >
      <div className="flex flex-col gap-3">
        {products.map((product) => (
          <ProductPanel key={product.id} product={product} />
        ))}
      </div>
    </SortableList>
  );
}
