import { z } from 'zod';

// A blank/whitespace-only string means "not provided" → undefined (stored null);
// otherwise the value is trimmed. Shared by optional free-text domain fields.
const blankToUndefined = (v: unknown) =>
  typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v;

export const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().max(max).optional());

export const optionalEmail = (message: string) =>
  z.preprocess(blankToUndefined, z.email(message).optional());
