import type { ReactNode } from 'react';
import type { StaticImageData } from 'next/image';
import {
  Calendar,
  CalendarDays,
  CalendarCog,
  ChefHat,
  CircleHelp,
  DollarSign,
  Headset,
  Home,
  LayoutGrid,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  UserCog,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';
import optionCalendarIcon from '@/assets/icons/option_calendar_icon.svg';
import optionPaymentIcon from '@/assets/icons/option_payment_icon.svg';
import optionGenericIcon from '@/assets/icons/option_generic_icon.svg';
import optionStationIcon from '@/assets/icons/option_station_icon.svg';

const iconSize = 18;

export const IconMap: Record<string, ReactNode> = {
  home: <Home size={iconSize} />,
  calendar: <Calendar size={iconSize} />,
  events: <CalendarDays size={iconSize} />,
  clients: <Users size={iconSize} />,
  payments: <Wallet size={iconSize} />,
  quotes: <ReceiptText size={iconSize} />,
  pipeline: <Workflow size={iconSize} />,
  staff: <ChefHat size={iconSize} />,
  catalog: <Package size={iconSize} />,
  prices: <DollarSign size={iconSize} />,
  eventTypes: <CalendarCog size={iconSize} />,
  settings: <Settings size={iconSize} />,
  more: <LayoutGrid size={iconSize} />,
  users: <UserCog size={iconSize} />,
  faq: <CircleHelp size={iconSize} />,
  support: <Headset size={iconSize} />,
  logout: <LogOut size={iconSize} />,
};

export const IconCardOptionsMap: Record<string, StaticImageData> = {
  events: optionCalendarIcon,
  clients: optionGenericIcon,
  payments: optionPaymentIcon,
  staff: optionGenericIcon,
  catalog: optionStationIcon,
  eventTypes: optionGenericIcon,
  settings: optionGenericIcon,
  users: optionGenericIcon,
};
