import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  ScrollText,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { PaymentMethod } from '@repo/schemas';

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  card: CreditCard,
  transfer: ArrowLeftRight,
  check: ScrollText,
  zelle: Wallet,
};
