'use client';
import { Image } from 'antd';
import { Image as ImageIcon } from 'lucide-react';
import { featuredImage, type GalleryImage } from '../gallery';

const SIZES = {
  xs: { box: 'size-5 rounded', icon: 12 },
  sm: { box: 'size-9 rounded-xl', icon: 16 },
  md: { box: 'size-12 rounded-lg', icon: 22 },
  lg: { box: 'size-16 rounded-2xl', icon: 28 },
  xl: { box: 'size-20 rounded-2xl', icon: 36 },
} as const;

interface ProductThumbProps {
  product: { name: string; images: readonly GalleryImage[] };
  size?: keyof typeof SIZES;
}

/** The featured thumbnail of a product, or a neutral placeholder when it has no images. */
export function ProductThumb({ product, size = 'sm' }: ProductThumbProps) {
  const { box, icon } = SIZES[size];
  const image = featuredImage(product.images);

  return (
    <span
      className={`bg-mist text-navy flex shrink-0 items-center justify-center overflow-hidden ${box}`}
    >
      {image ? (
        <Image
          src={image.thumbUrl}
          alt={product.name}
          preview={false}
          rootClassName="block size-full"
          className="size-full object-cover"
        />
      ) : (
        <ImageIcon size={icon} aria-hidden />
      )}
    </span>
  );
}
