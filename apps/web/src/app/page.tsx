'use client';
import { useRef } from 'react';
import { useSession } from '@/lib/auth/client';
import { NotesPage } from '@/features/notes';
import { AuthPage } from '@/features/auth/components/AuthPage';

export default function Home() {
  const { data: session, isPending } = useSession();
  const hasResolved = useRef(false);
  if (!isPending) hasResolved.current = true;

  if (!hasResolved.current) return null;
  if (!session) return <AuthPage />;
  return <NotesPage />;
}
