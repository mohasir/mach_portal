import type { ReactNode } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarCog,
  ChefHat,
  CircleHelp,
  DollarSign,
  Headset,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  UserCog,
  Users,
  Workflow,
} from 'lucide-react';

const iconSize = 18;

export const IconMap: Record<string, ReactNode> = {
  dashboard: <LayoutDashboard size={iconSize} />,
  calendar: <Calendar size={iconSize} />,
  events: <CalendarDays size={iconSize} />,
  clients: <Users size={iconSize} />,
  quotes: <ReceiptText size={iconSize} />,
  pipeline: <Workflow size={iconSize} />,
  staff: <ChefHat size={iconSize} />,
  catalog: <Package size={iconSize} />,
  prices: <DollarSign size={iconSize} />,
  eventTypes: <CalendarCog size={iconSize} />,
  settings: <Settings size={iconSize} />,
  users: <UserCog size={iconSize} />,
  faq: <CircleHelp size={iconSize} />,
  support: <Headset size={iconSize} />,
  logout: <LogOut size={iconSize} />,
};
