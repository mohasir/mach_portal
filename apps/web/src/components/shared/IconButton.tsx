'use client';
import type { MouseEventHandler } from 'react';
import { Button } from 'antd';
import { IconBadge, type IconComponent } from './IconBadge';

const ICON_BUTTON_SIZES = {
  xs: { iconSize: 12, badgeSize: 'xs', rounded: 'rounded-md', buttonSize: 'small' },
  sm: { iconSize: 14, badgeSize: 'sm', rounded: 'rounded-lg', buttonSize: 'small' },
  md: { iconSize: 16, badgeSize: 'md', rounded: undefined, buttonSize: 'middle' },
} as const;

interface IconButtonProps {
  icon: IconComponent;
  size?: keyof typeof ICON_BUTTON_SIZES;
  shape?: 'circle' | 'square';
  className?: string;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  'aria-label': string;
}

/** Icon-only action button: an IconBadge as the visual, wrapped in a text Button for
 * the click target, focus ring and hover feedback. `size` derives the badge's pixel
 * size and corner radius together, since they always move in lockstep at call sites. */
export function IconButton({
  icon,
  size = 'md',
  shape = 'square',
  className,
  danger,
  loading,
  disabled,
  onClick,
  'aria-label': ariaLabel,
}: IconButtonProps) {
  const { iconSize, badgeSize, rounded, buttonSize } = ICON_BUTTON_SIZES[size];
  return (
    <Button
      type="text"
      size={buttonSize}
      shape={shape}
      danger={danger}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      icon={
        <IconBadge
          icon={icon}
          shape={shape}
          badgeSize={badgeSize}
          size={iconSize}
          rounded={rounded}
          className={className}
        />
      }
    />
  );
}
