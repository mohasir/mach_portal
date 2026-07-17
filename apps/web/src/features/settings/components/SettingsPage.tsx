'use client';
import { useState } from 'react';
import { Card } from 'antd';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionMenu, type SectionMenuItem } from '@/components/shared/SectionMenu';
import { useIsSuperAdmin } from '@/lib/auth/useIsSuperAdmin';
import { ProfileSettingsForm } from './ProfileSettingsForm';
import { SecuritySettingsForm } from './SecuritySettingsForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import { PreferencesSettingsForm } from './PreferencesSettingsForm';
import { PermissionsSettingsForm } from './PermissionsSettingsForm';

type SettingsSection = 'profile' | 'security' | 'general' | 'preferences' | 'permissions';

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const isSuperAdmin = useIsSuperAdmin();
  const [section, setSection] = useState<SettingsSection>('profile');

  const menuItems: SectionMenuItem[] = [
    { key: 'profile', label: t('profile.title'), group: t('groups.account') },
    { key: 'security', label: t('security.title'), group: t('groups.account') },
    ...(isSuperAdmin
      ? [{ key: 'permissions', label: t('permissions.title'), group: t('groups.access') }]
      : []),
    { key: 'general', label: t('general.title'), group: t('groups.system') },
    { key: 'preferences', label: t('preferences.title'), group: t('groups.system') },
  ];

  const sectionLabel = menuItems.find((item) => item.key === section)?.label ?? '';

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-1">
            <span className="whitespace-nowrap">{t('title')}</span>
            <ChevronRight size={20} className="text-muted shrink-0" />
            <span className="text-muted font-sans text-base font-normal whitespace-nowrap">
              {sectionLabel}
            </span>
          </span>
        }
      />

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-6">
        <Card className="md:sticky md:top-4 md:self-start" classNames={{ body: 'p-2' }}>
          <SectionMenu
            items={menuItems}
            activeKey={section}
            onSelect={(key) => setSection(key as SettingsSection)}
          />
        </Card>

        <div className="min-w-0 flex-1">
          {section === 'profile' && <ProfileSettingsForm />}
          {section === 'security' && <SecuritySettingsForm />}
          {section === 'general' && <GeneralSettingsForm />}
          {section === 'preferences' && <PreferencesSettingsForm />}
          {section === 'permissions' && isSuperAdmin && <PermissionsSettingsForm />}
        </div>
      </div>
    </div>
  );
}
