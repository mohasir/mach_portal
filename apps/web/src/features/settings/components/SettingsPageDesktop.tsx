'use client';
import { Card } from 'antd';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionMenu, type SectionMenuItem } from '@/components/shared/SectionMenu';
import { ProfileSettingsForm } from './ProfileSettingsForm';
import { SecuritySettingsForm } from './SecuritySettingsForm';
import { GeneralSettingsForm } from './GeneralSettingsForm';
import { PreferencesSettingsForm } from './PreferencesSettingsForm';
import { PermissionsSettingsForm } from './PermissionsSettingsForm';
import { QuotePdfTemplateForm } from './forms/QuotePdfTemplateForm';
import type { SettingsSection } from './SettingsPage';

interface SettingsPageDesktopProps {
  menuItems: SectionMenuItem[];
  isSuperAdmin: boolean;
  section: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
}

export function SettingsPageDesktop({
  menuItems,
  isSuperAdmin,
  section,
  onSelectSection,
}: SettingsPageDesktopProps) {
  const { t } = useTranslation('settings');
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
        backHref="/admin/options"
      />

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-6">
        <Card className="md:sticky md:top-4 md:self-start" classNames={{ body: 'p-2' }}>
          <SectionMenu
            items={menuItems}
            activeKey={section}
            onSelect={(key) => onSelectSection(key as SettingsSection)}
          />
        </Card>

        <div className="min-w-0 flex-1">
          {section === 'profile' && <ProfileSettingsForm />}
          {section === 'security' && <SecuritySettingsForm />}
          {section === 'general' && <GeneralSettingsForm />}
          {section === 'preferences' && <PreferencesSettingsForm />}
          {section === 'quotePdfTemplate' && <QuotePdfTemplateForm />}
          {section === 'permissions' && isSuperAdmin && <PermissionsSettingsForm />}
        </div>
      </div>
    </div>
  );
}
