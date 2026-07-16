import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EventsViewTab = 'events' | 'quotes' | 'pipeline';

interface EventsViewState {
  activeTab: EventsViewTab;
  setActiveTab: (tab: EventsViewTab) => void;
}

export const useEventsViewStore = create<EventsViewState>()(
  persist(
    (set) => ({
      activeTab: 'events',
      setActiveTab: (activeTab) => set({ activeTab }),
    }),
    { name: 'events-view' },
  ),
);
