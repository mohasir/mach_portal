import type { IconType } from 'react-icons';
import type { AppLocale } from '@repo/schemas';

export type LocalizedText = Record<AppLocale, string>;

export type ReleaseNoteSlide = {
  title: LocalizedText;
  description: LocalizedText;
  /** Shown above the text with decorative sparkles. */
  icon?: IconType;
};

export type ReleaseNote = {
  version: string;
  slides: ReleaseNoteSlide[];
};

export type ReleaseNotesAction = 'show' | 'markSeen' | 'none';
