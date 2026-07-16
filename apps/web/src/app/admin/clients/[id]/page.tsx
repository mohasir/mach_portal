import { ClientDetailPage } from '@/features/clients';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ClientDetailPage clientId={id} />;
}
