import type { ComponentType } from 'react';

type IconComponent = ComponentType<{ size?: number }>;

const BADGE_SIZE_CLASSES = {
  sm: 'size-7',
  md: 'size-9',
} as const;

interface IconBadgeProps {
  icon: IconComponent;
  size?: number;
  shape?: 'circle' | 'square';
  badgeSize?: keyof typeof BADGE_SIZE_CLASSES;
  className?: string;
}

export function IconBadge({
  icon: Icon,
  size = 16,
  shape = 'circle',
  badgeSize = 'md',
  className = 'bg-olive-faint text-brown',
}: IconBadgeProps) {
  return (
    <span
      className={`flex ${BADGE_SIZE_CLASSES[badgeSize]} shrink-0 items-center justify-center ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'} ${className}`}
    >
      <Icon size={size} />
    </span>
  );
}
