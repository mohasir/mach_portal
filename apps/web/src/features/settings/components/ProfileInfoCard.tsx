'use client';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth/client';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { RoleTag } from '@/components/shared/RoleTag';
import { useCurrentRole } from '@/lib/auth/useCan';
import { ProfileNameForm } from './forms/ProfileNameForm';
import { WrapperCard } from '@/components/shared/WrapperCard';

export function ProfileInfoCard() {
  const { t } = useTranslation('settings');
  const { data } = useSession();
  const user = data?.user;
  const role = useCurrentRole();

  return (
    <WrapperCard title={t('profile.title')}>
      <div className="mb-6">
        <AvatarUser
          name={user?.name ?? ''}
          email={user?.email}
          size={64}
          extra={<RoleTag role={role} className="mt-1" />}
        />
      </div>

      <ProfileNameForm />
    </WrapperCard>
  );
}
