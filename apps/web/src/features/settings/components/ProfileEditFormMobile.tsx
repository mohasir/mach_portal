'use client';
import { useTranslation } from 'react-i18next';
import { ChangePasswordCard } from './forms/ChangePasswordCard';
import { ProfileNameForm } from './forms/ProfileNameForm';
import { WrapperCard } from '@/components/shared/WrapperCard';

export function ProfileEditFormMobile() {
  const { t } = useTranslation('settings');

  return (
    <div className="flex flex-col gap-6">
      <WrapperCard title={t('profile.title')}>
        <ProfileNameForm />
      </WrapperCard>

      <ChangePasswordCard />
    </div>
  );
}
