import type { ReleaseNote } from '../types';
import { releaseNote_0_16_0 } from './0.16.0';

// One entry per web version with notes for the client, keyed by that version
// (apps/web/package.json). Add `<version>.ts` next to this file and register it here.
export const RELEASE_NOTES: Record<string, ReleaseNote> = {
  '0.16.0': releaseNote_0_16_0,
};

export const getReleaseNote = (version: string): ReleaseNote | undefined => RELEASE_NOTES[version];
