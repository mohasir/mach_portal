'use client';
import type { IconComponent } from './IconBadge';
import { IconButton } from './IconButton';

export interface ViewModeOption<T extends string> {
  value: T;
  icon: IconComponent;
  label: string;
}

interface ViewModeToggleProps<T extends string> {
  options: ViewModeOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ViewModeToggle<T extends string>({
  options,
  value,
  onChange,
  className,
}: ViewModeToggleProps<T>) {
  return (
    <div role="group" className={`flex items-center rounded-xl bg-primary/10 ${className ?? ''}`}>
      {options.map((option) => (
        <IconButton
          key={option.value}
          icon={option.icon}
          aria-label={option.label}
          onClick={() => onChange(option.value)}
          className={option.value === value ? 'bg-primary text-white' : 'text-muted'}
        />
      ))}
    </div>
  );
}
