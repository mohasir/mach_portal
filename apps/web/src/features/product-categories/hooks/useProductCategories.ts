import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProductCategoryInput,
  ProductCategoriesListQuery,
  UpdateProductCategoryInput,
} from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';

export function useProductCategoriesList(query: ProductCategoriesListQuery) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.productCategories.list.queryOptions(query),
    placeholderData: keepPreviousData,
  });
}

/** Active categories for the product form and the catalog filter (also allowed to product readers). */
export function useCategoryOptions() {
  const trpc = useTRPC();
  return useQuery(trpc.productCategories.options.queryOptions());
}

// The catalog embeds each product's category name, so a category change also refreshes it.
function useInvalidateCategories() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries(trpc.productCategories.pathFilter()),
      qc.invalidateQueries(trpc.products.pathFilter()),
    ]);
}

export function useCreateProductCategory() {
  const trpc = useTRPC();
  const invalidate = useInvalidateCategories();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.productCategories.create.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    createCategory: (data: CreateProductCategoryInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateProductCategory() {
  const trpc = useTRPC();
  const invalidate = useInvalidateCategories();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.productCategories.update.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    updateCategory: (id: string, data: UpdateProductCategoryInput) =>
      mutation.mutateAsync({ id, data }),
    isPending: mutation.isPending,
  };
}

export function useToggleProductCategoryActive() {
  const trpc = useTRPC();
  const invalidate = useInvalidateCategories();
  const onError = useApiError();
  const disable = useMutation(
    trpc.productCategories.disable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const enable = useMutation(
    trpc.productCategories.enable.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    toggleActive: (id: string, isActive: boolean) =>
      (isActive ? enable : disable).mutateAsync({ id }),
    isPending: disable.isPending || enable.isPending,
  };
}

export function useDeleteProductCategory() {
  const trpc = useTRPC();
  const invalidate = useInvalidateCategories();
  const onError = useApiError();
  const mutation = useMutation(
    trpc.productCategories.delete.mutationOptions({ onSuccess: invalidate, onError }),
  );
  return {
    deleteCategory: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}
