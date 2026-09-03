'use client';
import type { ReactNode } from 'react';
import { Avatar, Typography } from 'antd';
import { getAvatarColor, getInitials } from '@/lib/utils/name';

interface AvatarUserProps {
  name: string;
  email?: string | null;
  image?: string | null;
  size?: number;
  fontSize?: number;
  extra?: ReactNode;
  showDetails?: boolean;
}

export function AvatarUser({
  name,
  email,
  image,
  size,
  fontSize,
  extra,
  showDetails = true,
}: AvatarUserProps) {
  const source = name?.trim() || email?.trim() || '';
  const initial = source ? getInitials(source) : '?';

  const avatar = (
    <Avatar
      src={image || undefined}
      size={size}
      style={fontSize ? { fontSize } : undefined}
      className={`${getAvatarColor(initial)} text-white shrink-0 font-medium`}
    >
      {initial}
    </Avatar>
  );

  if (!showDetails) return avatar;

  const hasDetails = !!email || !!extra;

  return (
    <div className={`flex min-w-0 gap-3 ${hasDetails ? 'items-start' : 'items-center'}`}>
      {avatar}
      <div className="min-w-0">
        <Typography.Text strong className="text-brown block truncate">
          {name || '—'}
        </Typography.Text>
        {email ? (
          <Typography.Text type="secondary" className="block truncate text-sm">
            {email}
          </Typography.Text>
        ) : null}
        {extra}
      </div>
    </div>
  );
}
