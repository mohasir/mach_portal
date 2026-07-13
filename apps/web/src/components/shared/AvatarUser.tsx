'use client';
import { Avatar, Typography } from 'antd';

interface AvatarUserProps {
  name: string;
  email?: string | null;
}

export function AvatarUser({ name, email }: AvatarUserProps) {
  const source = name?.trim() || email?.trim() || '';
  const initial = source ? source[0]!.toUpperCase() : '?';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="bg-olive-faint text-brown shrink-0 font-medium">{initial}</Avatar>
      <div className="min-w-0">
        <Typography.Text strong className="text-brown block truncate">
          {name || '—'}
        </Typography.Text>
        {email ? (
          <Typography.Text type="secondary" className="block truncate text-xs">
            {email}
          </Typography.Text>
        ) : null}
      </div>
    </div>
  );
}
