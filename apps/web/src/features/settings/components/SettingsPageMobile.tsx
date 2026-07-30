'use client';
import { FileText, KeyRound, ListOrdered, Shield, SlidersHorizontal, UserPen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import type { SectionMenuItem } from '@/components/shared/SectionMenu';
import { ProfileEditFormMobile } from './ProfileEditFormMobile';
import { ProfileSummaryCardMobile } from './ProfileSummaryCardMobile';
import { SecuritySettingsForm } from './SecuritySettingsForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import { PreferencesSettingsForm } from './PreferencesSettingsForm';
import { PermissionsSettingsForm } from './PermissionsSettingsForm';
import { QuotePdfTemplateForm } from './QuotePdfTemplateForm';
import { SettingsMenuMobile } from './SettingsMenuMobile';
import type { MobileSettingsSection } from './SettingsPage';

const MOBILE_SECTION_ICONS: Record<MobileSettingsSection, typeof UserPen> = {
  profileEdit: UserPen,
  security: Shield,
  permissions: KeyRound,
  general: SlidersHorizontal,
  preferences: ListOrdered,
  quotePdfTemplate: FileText,
};

interface SettingsPageMobileProps {
  menuItems: SectionMenuItem[];
  isSuperAdmin: boolean;
  section: MobileSettingsSection | null;
  onSelectSection: (section: MobileSettingsSection) => void;
  onBack: () => void;
}

export function SettingsPageMobile({
  menuItems,
  isSuperAdmin,
  section,
  onSelectSection,
  onBack,
}: SettingsPageMobileProps) {
  const { t } = useTranslation('settings');

  const mobileMenuItems = [
    { key: 'profileEdit' as const, label: t('profile.editTitle') },
    ...menuItems.filter((item) => item.key !== 'profile'),
  ].map((item) => ({ ...item, icon: MOBILE_SECTION_ICONS[item.key as MobileSettingsSection] }));

  if (section) {
    const label = mobileMenuItems.find((item) => item.key === section)?.label ?? '';
    return (
      <div className="px-2 py-4">
        <PageHeader title={label} onBack={onBack} />
        {section === 'profileEdit' && <ProfileEditFormMobile />}
        {section === 'security' && <SecuritySettingsForm />}
        {section === 'general' && <GeneralSettingsForm />}
        {section === 'preferences' && <PreferencesSettingsForm />}
        {section === 'quotePdfTemplate' && <QuotePdfTemplateForm />}
        {section === 'permissions' && isSuperAdmin && <PermissionsSettingsForm />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('profile.title')} backHref="/admin/options" showLogout />
      <ProfileSummaryCardMobile />
      <SettingsMenuMobile
        title={t('title')}
        items={mobileMenuItems}
        onSelect={(key) => onSelectSection(key as MobileSettingsSection)}
      />
    </div>
  );
}
