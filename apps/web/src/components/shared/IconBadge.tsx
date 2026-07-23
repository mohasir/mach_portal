import type { LucideIcon } from 'lucide-react';

interface IconBadgeProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
}

export function IconBadge({ icon: Icon, size = 16, className = 'bg-olive-faint text-brown' }: IconBadgeProps) {
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${className}`}>
      <Icon size={size} />
    </span>
  );
}
