import { ProductDetailPage } from '@/features/catalog';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProductDetailPage productId={id} />;
}
