import { EventDetailPage } from '@/features/events';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <EventDetailPage eventId={id} initialTab={tab} />;
}
