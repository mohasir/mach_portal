'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import { PreferencesSettingsForm } from './PreferencesSettingsForm';
import { SettingsMenu, type SettingsMenuItem } from './SettingsMenu';

type SettingsSection = 'general' | 'preferences';

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const [section, setSection] = useState<SettingsSection>('general');

  const menuItems: SettingsMenuItem[] = [
    { key: 'general', label: t('general.title') },
    { key: 'preferences', label: t('preferences.title') },
  ];

  return (
    <div>
      <PageHeader title={t('title')} />

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-12">
        <SettingsMenu
          items={menuItems}
          activeKey={section}
          onSelect={(key) => setSection(key as SettingsSection)}
        />

        <div className="min-w-0 flex-1">
          {section === 'general' && <GeneralSettingsForm />}
          {section === 'preferences' && <PreferencesSettingsForm />}
        </div>
      </div>
    </div>
  );
}
