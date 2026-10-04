import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TimeFormat } from '@repo/schemas';

interface TimeFormatState {
  timeFormat: TimeFormat;
  setTimeFormat: (timeFormat: TimeFormat) => void;
}

// Mirror of the user's saved `timeFormat` preference (kept in sync by useSyncUserPreferences).
// Persisted so the first paint already uses the last known format instead of flashing 12h.
export const useTimeFormatStore = create<TimeFormatState>()(
  persist(
    (set) => ({
      timeFormat: '12h',
      setTimeFormat: (timeFormat) => set({ timeFormat }),
    }),
    { name: 'time-format' },
  ),
);
