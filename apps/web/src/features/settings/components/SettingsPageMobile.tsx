'use client';
import {
  FileText,
  Info,
  KeyRound,
  LifeBuoy,
  ListOrdered,
  Shield,
  SlidersHorizontal,
  UserPen,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import type { SectionMenuItem } from '@/components/shared/SectionMenu';
import { ProfileEditFormMobile } from './ProfileEditFormMobile';
import { ProfileSummaryCardMobile } from './ProfileSummaryCardMobile';
import { SecuritySettingsForm } from './SecuritySettingsForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import { PreferencesSettingsForm } from './PreferencesSettingsForm';
import { PermissionsSettingsForm } from './PermissionsSettingsForm';
import { QuotePdfTemplateForm } from './forms/QuotePdfTemplateForm';
import { AboutSettingsForm } from './AboutSettingsForm';
import { SettingsMenuMobile } from './SettingsMenuMobile';
import type { MobileSettingsSection } from './SettingsPage';

const MOBILE_SECTION_ICONS: Record<MobileSettingsSection, typeof UserPen> = {
  profileEdit: UserPen,
  security: Shield,
  permissions: KeyRound,
  general: SlidersHorizontal,
  preferences: ListOrdered,
  quotePdfTemplate: FileText,
  support: LifeBuoy,
  about: Info,
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
    { key: 'profileEdit' as const, label: t('profile.editTitle'), group: t('groups.account') },
    ...menuItems.filter((item) => item.key !== 'profile'),
  ].map((item) => ({ ...item, icon: MOBILE_SECTION_ICONS[item.key as MobileSettingsSection] }));

  if (section) {
    const label = mobileMenuItems.find((item) => item.key === section)?.label ?? '';
    const isAbout = section === 'about';
    return (
      <div className={`px-2 py-4 ${isAbout ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
        <PageHeader title={label} onBack={onBack} />
        {section === 'profileEdit' && <ProfileEditFormMobile />}
        {section === 'security' && <SecuritySettingsForm />}
        {section === 'general' && <GeneralSettingsForm />}
        {section === 'preferences' && <PreferencesSettingsForm />}
        {section === 'quotePdfTemplate' && <QuotePdfTemplateForm />}
        {section === 'permissions' && isSuperAdmin && <PermissionsSettingsForm />}
        {section === 'about' && <AboutSettingsForm />}
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
