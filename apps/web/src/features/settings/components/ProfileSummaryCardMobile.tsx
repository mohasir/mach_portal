'use client';
import { Avatar, Flex, Typography } from 'antd';
import { useSession } from '@/lib/auth/client';
import { RoleTag } from '@/components/shared/RoleTag';

/** Read-only profile summary shown on the mobile Settings root — editing lives in ProfileEditFormMobile. */
export function ProfileSummaryCardMobile() {
  const { data } = useSession();
  const user = data?.user as
    { name: string; email: string; image?: string | null; role?: string | null } | undefined;

  const source = user?.name?.trim() || user?.email?.trim() || '';
  const initial = source ? source[0]!.toUpperCase() : '?';

  return (
    <div className="flex flex-col items-center gap-1 py-2 text-center">
      <Avatar
        src={user?.image ?? undefined}
        size={80}
        className="bg-olive-faint text-brown font-medium"
      >
        {initial}
      </Avatar>
      <Flex vertical>
        <Typography.Text strong className="text-brown text-base">
          {user?.name || '—'}
        </Typography.Text>
        {user?.email && (
          <Typography.Text type="secondary" className="text-xs">
            {user.email}
          </Typography.Text>
        )}
      </Flex>
      <RoleTag role={user?.role} className="mt-1" />
    </div>
  );
}
