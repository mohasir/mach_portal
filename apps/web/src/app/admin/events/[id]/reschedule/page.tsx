import { RescheduleEventPage } from '@/features/events';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ id }, { returnTo }] = await Promise.all([params, searchParams]);
  return <RescheduleEventPage eventId={id} returnTo={returnTo} />;
}
