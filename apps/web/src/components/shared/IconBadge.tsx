import type { LucideIcon } from 'lucide-react';

interface IconBadgeProps {
  icon: LucideIcon;
  size?: number;
  shape?: 'circle' | 'square';
  className?: string;
}

export function IconBadge({
  icon: Icon,
  size = 16,
  shape = 'circle',
  className = 'bg-olive-faint text-brown',
}: IconBadgeProps) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'} ${className}`}
    >
      <Icon size={size} />
    </span>
  );
}
