'use client';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth/client';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { RoleTag } from '@/components/shared/RoleTag';
import { ProfileNameForm } from './forms/ProfileNameForm';
import { WrapperCard } from '@/components/shared/WrapperCard';

export function ProfileInfoCard() {
  const { t } = useTranslation('settings');
  const { data } = useSession();
  const user = data?.user as
    { name: string; email: string; image?: string | null; role?: string | null } | undefined;

  return (
    <WrapperCard title={t('profile.title')}>
      <div className="mb-6">
        <AvatarUser
          name={user?.name ?? ''}
          email={user?.email}
          size={64}
          extra={<RoleTag role={user?.role} className="mt-1" />}
        />
      </div>

      <ProfileNameForm />
    </WrapperCard>
  );
}
