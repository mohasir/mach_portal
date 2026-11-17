'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError, reportApiErrorCode } from '@/lib/error/useApiError';

export function useUploadProductImage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('catalog');
  const { t: tApi } = useTranslation('api');
  const vocabulary = useCatalogVocabulary();

  return {
    // Multipart goes to the Express route, not tRPC; AntD's uploader posts the file itself.
    uploadUrl: (productId: string) => `/api/uploads/products/${productId}/images`,
    onUploaded: () => {
      message.success(t('gallery.uploaded'));
      void qc.invalidateQueries(trpc.products.pathFilter());
    },
    onUploadError: (errorCode: string | undefined) =>
      reportApiErrorCode(errorCode, tApi, message, vocabulary),
  };
}

export function useProductImageMutations() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const invalidate = () => qc.invalidateQueries(trpc.products.pathFilter());

  const setFeatured = useMutation(
    trpc.products.images.setFeatured.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const reorder = useMutation(
    trpc.products.images.reorder.mutationOptions({ onSuccess: invalidate, onError }),
  );
  const remove = useMutation(
    trpc.products.images.delete.mutationOptions({ onSuccess: invalidate, onError }),
  );

  return {
    setFeaturedImage: (productId: string, imageId: string) =>
      setFeatured.mutateAsync({ productId, imageId }),
    reorderImages: (productId: string, ids: string[]) => reorder.mutateAsync({ productId, ids }),
    deleteImage: (productId: string, imageId: string) => remove.mutateAsync({ productId, imageId }),
    isPending: setFeatured.isPending || reorder.isPending || remove.isPending,
  };
}
