import type { ComponentType } from 'react';

export type IconComponent = ComponentType<{ size?: number }>;

const BADGE_SIZE_CLASSES = {
  xs: 'size-6',
  sm: 'size-7',
  md: 'size-9',
} as const;

interface IconBadgeProps {
  icon: IconComponent;
  size?: number;
  shape?: 'circle' | 'square';
  badgeSize?: keyof typeof BADGE_SIZE_CLASSES;
  rounded?: string;
  className?: string;
}

export function IconBadge({
  icon: Icon,
  size = 16,
  shape = 'circle',
  badgeSize = 'md',
  rounded,
  className = 'bg-primary/10 text-brown',
}: IconBadgeProps) {
  const roundedClass = rounded ?? (shape === 'circle' ? 'rounded-full' : 'rounded-xl');
  return (
    <span
      className={`flex ${BADGE_SIZE_CLASSES[badgeSize]} shrink-0 items-center justify-center ${roundedClass} ${className}`}
    >
      <Icon size={size} />
    </span>
  );
}
