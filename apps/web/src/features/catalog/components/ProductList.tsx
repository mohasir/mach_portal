'use client';
import { useProductMutations } from '../hooks/useProductMutations';
import { moveItem } from '../helpers';
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
        {products.map((product, index) => (
          <ProductPanel
            key={product.id}
            product={product}
            onEdit={onEdit}
            onMoveUp={() => reorderProducts(moveItem(ids, product.id, 'up'))}
            onMoveDown={() => reorderProducts(moveItem(ids, product.id, 'down'))}
            disableUp={index === 0}
            disableDown={index === products.length - 1}
          />
        ))}
      </div>
    </SortableList>
  );
}
