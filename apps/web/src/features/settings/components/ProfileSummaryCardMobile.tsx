'use client';
import { Card, Flex, Typography } from 'antd';
import { useSession } from '@/lib/auth/client';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { RoleTag } from '@/components/shared/RoleTag';
import { useCurrentRole } from '@/lib/auth/useCan';

/** Read-only profile summary shown on the mobile Settings root — editing lives in ProfileEditFormMobile. */
export function ProfileSummaryCardMobile() {
  const { data } = useSession();
  const user = data?.user;
  const role = useCurrentRole();

  return (
    <Card className="flex flex-col items-center gap-1 py-2 text-center">
      <AvatarUser
        name={user?.name ?? ''}
        email={user?.email}
        image={user?.image}
        size={80}
        showDetails={false}
      />
      <Flex vertical>
        <Typography.Text strong className="text-navy text-base">
          {user?.name || '—'}
        </Typography.Text>
        {user?.email && (
          <Typography.Text type="secondary" className="text-xs">
            {user.email}
          </Typography.Text>
        )}
      </Flex>
      <RoleTag role={role} className="mt-1" />
    </Card>
  );
}
