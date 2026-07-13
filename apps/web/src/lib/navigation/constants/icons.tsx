import type { ReactNode } from 'react';
import {
  CalendarDays,
  CalendarCog,
  ChefHat,
  CircleHelp,
  Headset,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  UserCog,
  Users,
  Workflow,
} from 'lucide-react';

export const IconMap: Record<string, ReactNode> = {
  dashboard: <LayoutDashboard size={18} />,
  events: <CalendarDays size={18} />,
  clients: <Users size={18} />,
  quotes: <ReceiptText size={18} />,
  pipeline: <Workflow size={18} />,
  staff: <ChefHat size={18} />,
  catalog: <Package size={18} />,
  eventTypes: <CalendarCog size={18} />,
  users: <UserCog size={18} />,
  faq: <CircleHelp size={18} />,
  support: <Headset size={18} />,
  logout: <LogOut size={18} />,
};
