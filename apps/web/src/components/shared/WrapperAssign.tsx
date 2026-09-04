'use client';
import type { ReactNode } from 'react';
import { Button, Empty, Input, Spin } from 'antd';
import { UserMinus } from 'lucide-react';
import { IconBadge } from '@/components/shared/IconBadge';

interface WrapperAssignProps<TItem, TAssigned = TItem> {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;

  assignedLabel?: string;
  assignedItems?: TAssigned[];
  assignedItemKey?: (item: TAssigned) => string;
  renderAssignedItem?: (item: TAssigned) => ReactNode;
  onRemoveAssigned?: (item: TAssigned) => void;
  removeDisabled?: boolean;
  removeAriaLabel?: string;

  isLoading: boolean;
  items: TItem[];
  itemKey: (item: TItem) => string;
  renderItem: (item: TItem) => ReactNode;
  onSelectItem: (item: TItem) => void;
  itemDisabled?: boolean;
  otherLabel?: string;
  emptyDescription: string;
  emptyAction?: ReactNode;
}

/** Search + assigned/other list layout shared by the mobile "assign X" bottom sheets
 * (staff, quote owner, client). Purely presentational — data fetching, filtering and
 * the assign/remove mutations stay in each feature's sheet component. */
export function WrapperAssign<TItem, TAssigned = TItem>({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  assignedLabel,
  assignedItems = [],
  assignedItemKey,
  renderAssignedItem,
  onRemoveAssigned,
  removeDisabled,
  removeAriaLabel,
  isLoading,
  items,
  itemKey,
  renderItem,
  onSelectItem,
  itemDisabled,
  otherLabel,
  emptyDescription,
  emptyAction,
}: WrapperAssignProps<TItem, TAssigned>) {
  return (
    <div className="flex flex-col gap-2 px-4 pb-4">
      <Input.Search
        allowClear
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {assignedItems.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {assignedLabel && <span className="px-1 text-xs text-gray-500">{assignedLabel}</span>}
          <div className="flex flex-col gap-2">
            {assignedItems.map((item) => (
              <div
                key={assignedItemKey?.(item)}
                className="bg-primary/5 flex items-center justify-between rounded-2xl py-2 px-3"
              >
                {renderAssignedItem?.(item)}
                <Button
                  type="text"
                  danger
                  disabled={removeDisabled}
                  onClick={() => onRemoveAssigned?.(item)}
                  icon={
                    <IconBadge
                      icon={UserMinus}
                      shape="square"
                      badgeSize="sm"
                      size={14}
                      rounded="rounded-lg"
                      className="bg-salmon/20 text-error"
                    />
                  }
                  aria-label={removeAriaLabel}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spin size="small" />
        </div>
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription}>
          {emptyAction}
        </Empty>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {otherLabel && <span className="px-1 text-xs text-gray-500">{otherLabel}</span>}
          <div className="bg-primary/5 flex flex-col rounded-3xl p-4">
            {items.map((item) => (
              <button
                key={itemKey(item)}
                type="button"
                disabled={itemDisabled}
                onClick={() => onSelectItem(item)}
                className="flex items-center gap-3 py-3 text-left disabled:opacity-50"
              >
                {renderItem(item)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
