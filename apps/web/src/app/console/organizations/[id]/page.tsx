import { OrganizationDetailPage } from '@/features/console';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <OrganizationDetailPage organizationId={id} />;
}
