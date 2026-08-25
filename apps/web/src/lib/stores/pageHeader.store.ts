import { create } from 'zustand';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface MobilePageHeaderAction {
  icon: LucideIcon;
  onClick: () => void;
  ariaLabel: string;
}

interface MobilePageHeader {
  title: ReactNode;
  titleSuffix?: ReactNode;
  onBack?: () => void;
  showLogout?: boolean;
  action?: MobilePageHeaderAction;
  titleSize?: 'default' | 'sm';
}

interface PageHeaderState {
  header: MobilePageHeader | null;
  setHeader: (header: MobilePageHeader) => void;
  clearHeader: () => void;
}

export const usePageHeaderStore = create<PageHeaderState>((set) => ({
  header: null,
  setHeader: (header) => set({ header }),
  clearHeader: () => set({ header: null }),
}));
