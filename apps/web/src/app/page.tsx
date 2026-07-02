'use client';
import { useSession } from '@/lib/auth/client';
import { NotesPage } from '@/features/notes';
import { AuthPage } from '@/features/auth/components/AuthPage';

export default function Home() {
  const { data: session, isPending } = useSession();

  if (isPending) return null;
  if (!session) return <AuthPage />;
  return <NotesPage />;
}
