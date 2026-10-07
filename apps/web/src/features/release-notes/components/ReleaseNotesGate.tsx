'use client';
import { useEffect, useRef, useState } from 'react';
import { env } from '@/env';
import { useConfig } from '@/features/settings';
import { useSession } from '@/lib/auth/client';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { getReleaseNote } from '../content';
import { resolveGateState } from '../helpers';
import { useMarkReleaseNotesSeen, useReleaseNotesPreferences } from '../hooks/useReleaseNotes';
import type { ReleaseNote } from '../types';
import { ReleaseNotesModal } from './ReleaseNotesModal';

const CURRENT_VERSION = env.NEXT_PUBLIC_APP_VERSION;

export function ReleaseNotesGate() {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const { data: config } = useConfig(!!userId);
  const enabled = !!config?.appSettings.showReleaseNotes;
  const { data: preferences, isFetchedAfterMount } = useReleaseNotesPreferences(
    !!userId && enabled,
  );
  const markSeen = useMarkReleaseNotesSeen();
  const locale = useLocaleStore((s) => s.locale);
  const [openNote, setOpenNote] = useState<ReleaseNote | null>(null);
  // One decision per user and version: re-renders (or StrictMode) must not write twice.
  const decidedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    // The preferences cache isn't per user; deciding only on a fetch made after mount avoids
    // acting on another account's cached preferences.
    if (!userId || !isFetchedAfterMount) return;
    const key = `${userId}:${CURRENT_VERSION}`;
    if (decidedFor.current === key) return;

    const { action, note } = resolveGateState({
      enabled,
      currentVersion: CURRENT_VERSION,
      preferences,
      note: getReleaseNote(CURRENT_VERSION),
    });
    if (action === 'none') return;
    decidedFor.current = key;
    if (action === 'markSeen') markSeen(CURRENT_VERSION);
    if (action === 'show' && note) setOpenNote(note);
  }, [userId, enabled, preferences, isFetchedAfterMount, markSeen]);

  if (!openNote) return null;

  return (
    <ReleaseNotesModal
      note={openNote}
      locale={locale}
      onDone={() => {
        setOpenNote(null);
        markSeen(CURRENT_VERSION);
      }}
    />
  );
}
