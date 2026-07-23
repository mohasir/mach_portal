'use client';
import { useTranslation } from 'react-i18next';
import { ChangePasswordCard } from './ChangePasswordCard';
import { ProfileNameForm } from './ProfileNameForm';
import { SettingsCard } from './SettingsCard';

export function ProfileEditFormMobile() {
  const { t } = useTranslation('settings');

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard title={t('profile.title')}>
        <ProfileNameForm />
      </SettingsCard>

      <ChangePasswordCard />
    </div>
  );
}
