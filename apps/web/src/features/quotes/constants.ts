import {
  Apple,
  Coffee,
  Cookie,
  IceCream,
  Martini,
  Pizza,
  Popcorn,
  Sandwich,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react';

export const STATION_ICON_RULES: { keywords: string[]; icon: LucideIcon }[] = [
  { keywords: ['nacho'], icon: Pizza },
  { keywords: ['fruit', 'fruta'], icon: Apple },
  { keywords: ['crepa', 'crepe', 'waffle', 'helado', 'ice cream'], icon: IceCream },
  { keywords: ['candy', 'dulce', 'cookie', 'galleta'], icon: Cookie },
  { keywords: ['coffee', 'cafe', 'café'], icon: Coffee },
  { keywords: ['bar', 'drink', 'cocktail', 'bebida', 'craft', 'wine', 'vino'], icon: Martini },
  { keywords: ['sandwich', 'torta'], icon: Sandwich },
  { keywords: ['popcorn', 'palomitas'], icon: Popcorn },
];

export const DEFAULT_STATION_ICON: LucideIcon = UtensilsCrossed;
