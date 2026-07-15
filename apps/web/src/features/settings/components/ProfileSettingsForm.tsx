'use client';
import { ProfileInfoCard } from './ProfileInfoCard';
import { ChangePasswordCard } from './ChangePasswordCard';

export function ProfileSettingsForm() {
  return (
    <div className="flex flex-col gap-6">
      <ProfileInfoCard />
      <ChangePasswordCard />
    </div>
  );
}
