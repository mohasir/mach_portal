'use client';
import type { ReactNode } from 'react';
import { Avatar, Typography } from 'antd';

interface AvatarUserProps {
  name: string;
  email?: string | null;
  image?: string | null;
  size?: number;
  extra?: ReactNode;
  showDetails?: boolean;
}

export function AvatarUser({
  name,
  email,
  image,
  size,
  extra,
  showDetails = true,
}: AvatarUserProps) {
  const source = name?.trim() || email?.trim() || '';
  const initial = source ? source[0]!.toUpperCase() : '?';

  const avatar = (
    <Avatar src={image || undefined} size={size} className="bg-olive-faint text-brown shrink-0 font-medium">
      {initial}
    </Avatar>
  );

  if (!showDetails) return avatar;

  return (
    <div className="flex min-w-0 items-center gap-3">
      {avatar}
      <div className="min-w-0">
        <Typography.Text strong className="text-brown block truncate">
          {name || '—'}
        </Typography.Text>
        {email ? (
          <Typography.Text type="secondary" className="block truncate text-xs">
            {email}
          </Typography.Text>
        ) : null}
        {extra}
      </div>
    </div>
  );
}
