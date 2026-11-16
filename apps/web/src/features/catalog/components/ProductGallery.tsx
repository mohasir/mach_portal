'use client';
import { useState } from 'react';
import { App, Image, Spin, Tag, Typography, Upload } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { ChevronLeft, ChevronRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PRODUCT_IMAGE_ALLOWED_MIME_TYPES, PRODUCT_IMAGE_MAX_SIZE_BYTES } from '@repo/schemas';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconButton } from '@/components/shared/IconButton';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { fitsInGallery, galleryState, moveImage } from '../gallery';
import { useProductImageMutations, useUploadProductImage } from '../hooks/useProductImages';
import type { Product } from '../types';

interface ProductGalleryProps {
  product: Pick<Product, 'id' | 'name' | 'images'>;
  canEdit: boolean;
}

const ACCEPT: readonly string[] = PRODUCT_IMAGE_ALLOWED_MIME_TYPES;
const MAX_SIZE_MB = Math.round(PRODUCT_IMAGE_MAX_SIZE_BYTES / (1024 * 1024));

export function ProductGallery({ product, canEdit }: ProductGalleryProps) {
  const { t } = useTranslation('catalog');
  const vocabulary = useCatalogVocabulary();
  const { message } = App.useApp();
  const [confirm, confirmContextHolder] = useActionConfirm();
  const { uploadUrl, onUploaded, onUploadError } = useUploadProductImage();
  const { setFeaturedImage, reorderImages, deleteImage, isPending } = useProductImageMutations();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const { images } = product;
  const { count, max, canUpload, isEmpty } = galleryState(images);
  const ids = images.map((image) => image.id);
  const uploading = fileList.some((file) => file.status === 'uploading');

  const onChange: UploadProps['onChange'] = (info) => {
    if (info.file.status === 'done') onUploaded();
    else if (info.file.status === 'error') {
      onUploadError((info.file.response as { errorCode?: string } | undefined)?.errorCode);
    }
    setFileList(info.fileList.filter((file) => file.status === 'uploading'));
  };

  const beforeUpload: UploadProps['beforeUpload'] = (file, batch) => {
    if (!ACCEPT.includes(file.type)) {
      message.error(t('gallery.invalidType'));
      return Upload.LIST_IGNORE;
    }
    if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
      message.error(t('gallery.tooLarge', { size: MAX_SIZE_MB }));
      return Upload.LIST_IGNORE;
    }
    if (!fitsInGallery(count, batch.indexOf(file))) {
      message.error(t('gallery.limitReached', { max, ...vocabulary }));
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const move = (id: string, direction: -1 | 1) => {
    const next = moveImage(ids, id, direction);
    if (next) void reorderImages(product.id, next);
  };

  const handleDelete = (imageId: string) =>
    confirm({
      title: t('gallery.deleteConfirm.title'),
      content: t('gallery.deleteConfirm.content'),
      danger: true,
      onOk: () => deleteImage(product.id, imageId),
    });

  return (
    <WrapperCard
      title={t('gallery.title')}
      extra={
        <Typography.Text type="secondary" className="text-sm">
          {t('gallery.counter', { count, max })}
        </Typography.Text>
      }
    >
      <Spin spinning={isPending}>
        {isEmpty && !canEdit ? (
          <Typography.Text type="secondary" className="text-sm">
            {t('gallery.empty')}
          </Typography.Text>
        ) : (
          <Image.PreviewGroup>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {images.map((image, index) => (
                <div key={image.id} className="flex flex-col gap-1">
                  <div className="border-line relative aspect-square overflow-hidden rounded-xl border">
                    <Image
                      src={image.thumbUrl}
                      alt={product.name}
                      preview={{ src: image.imageUrl }}
                      rootClassName="block size-full"
                      className="size-full object-cover"
                    />
                    {image.isFeatured && (
                      <Tag
                        color="gold"
                        icon={<Star size={12} fill="currentColor" />}
                        className="absolute top-1 left-1 m-0"
                      >
                        {t('gallery.featured')}
                      </Tag>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <IconButton
                          icon={ChevronLeft}
                          size="sm"
                          disabled={index === 0}
                          onClick={() => move(image.id, -1)}
                          aria-label={t('gallery.moveLeft')}
                        />
                        <IconButton
                          icon={ChevronRight}
                          size="sm"
                          disabled={index === images.length - 1}
                          onClick={() => move(image.id, 1)}
                          aria-label={t('gallery.moveRight')}
                        />
                      </div>
                      <div className="flex items-center">
                        {!image.isFeatured && (
                          <IconButton
                            icon={Star}
                            size="sm"
                            onClick={() => void setFeaturedImage(product.id, image.id)}
                            aria-label={t('gallery.setFeatured')}
                          />
                        )}
                        <IconButton
                          icon={Trash2}
                          size="sm"
                          danger
                          className="bg-error/20 text-error"
                          onClick={() => handleDelete(image.id)}
                          aria-label={t('gallery.delete')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {canEdit && canUpload && (
                <Upload
                  name="file"
                  action={uploadUrl(product.id)}
                  withCredentials
                  multiple
                  accept={ACCEPT.join(',')}
                  showUploadList={false}
                  fileList={fileList}
                  beforeUpload={beforeUpload}
                  onChange={onChange}
                  disabled={uploading}
                  rootClassName="block"
                  className="block"
                >
                  <button
                    type="button"
                    disabled={uploading}
                    className="border-line text-muted hover:text-navy flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-2 text-center text-xs"
                  >
                    {uploading ? <Spin size="small" /> : <ImagePlus size={22} />}
                    <span>{t('gallery.add')}</span>
                    <span>{t('gallery.hint', { size: MAX_SIZE_MB })}</span>
                  </button>
                </Upload>
              )}
            </div>
          </Image.PreviewGroup>
        )}
      </Spin>
      {confirmContextHolder}
    </WrapperCard>
  );
}
