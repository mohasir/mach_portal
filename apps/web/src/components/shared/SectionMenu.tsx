'use client';
import { Fragment } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface SectionMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  group?: string;
}

interface SectionMenuProps {
  items: SectionMenuItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function SectionMenu({ items, activeKey, onSelect }: SectionMenuProps) {
  return (
    <nav className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto md:w-56 md:flex-col md:overflow-visible">
      {items.map(({ key, label, icon: Icon, group }, index) => {
        const active = key === activeKey;
        const showGroupHeader = !!group && group !== items[index - 1]?.group;
        return (
          <Fragment key={key}>
            {showGroupHeader && (
              <div className="text-gray-500 hidden px-3 pt-3 pb-1 text-xs md:block">{group}</div>
            )}
            <button
              type="button"
              onClick={() => onSelect(key)}
              aria-current={active ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-base whitespace-nowrap transition-colors ${
                group ? 'md:pl-5' : ''
              } ${
                active
                  ? 'bg-gray-100 text-primary'
                  : 'text-muted hover:bg-gray-100 hover:text-foreground'
              }`}
            >
              {Icon && <Icon size={18} className={active ? 'text-brown' : 'text-muted'} />}
              {label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
