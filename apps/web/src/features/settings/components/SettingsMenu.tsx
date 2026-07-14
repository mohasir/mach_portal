'use client';
import type { LucideIcon } from 'lucide-react';

export interface SettingsMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
}

interface SettingsMenuProps {
  items: SettingsMenuItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function SettingsMenu({ items, activeKey, onSelect }: SettingsMenuProps) {
  return (
    <nav className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
      {items.map(({ key, label, icon: Icon }) => {
        const active = key === activeKey;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors ${
              active
                ? 'bg-gray-100 text-primary'
                : 'text-muted hover:bg-gray-100 hover:text-foreground'
            }`}
          >
            {Icon && <Icon size={18} className={active ? 'text-brown' : 'text-muted'} />}
            {label}
          </button>
        );
      })}
    </nav>
  );
}
