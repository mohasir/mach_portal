import type { ReactNode } from 'react';
import {
  BarChart3,
  CircleHelp,
  FileText,
  Headset,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react';

export const IconMap: Record<string, ReactNode> = {
  dashboard: <LayoutDashboard size={18} />,
  orders: <ShoppingBag size={18} />,
  clients: <Users size={18} />,
  statistics: <BarChart3 size={18} />,
  finance: <Wallet size={18} />,
  notes: <FileText size={18} />,
  faq: <CircleHelp size={18} />,
  support: <Headset size={18} />,
  logout: <LogOut size={18} />,
};
