'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { SectionMenuItem } from '@/components/shared/SectionMenu';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useIsSuperAdmin } from '@/lib/auth/useIsSuperAdmin';
import { useCan } from '@/lib/auth/useCan';
import { SettingsPageDesktop } from './SettingsPageDesktop';
import { SettingsPageMobile } from './SettingsPageMobile';

export type SettingsSection =
  'profile' | 'security' | 'general' | 'preferences' | 'quotePdfTemplate' | 'permissions';
export type MobileSettingsSection = Exclude<SettingsSection, 'profile'> | 'profileEdit';

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const isSuperAdmin = useIsSuperAdmin();
  const can = useCan();
  const isDesktop = useIsDesktop();
  const [section, setSection] = useState<SettingsSection>('profile');
  const [mobileSection, setMobileSection] = useState<MobileSettingsSection | null>(null);

  const canViewGeneral =
    can({ [RESOURCES.TAX_RATES]: [ACTIONS.VIEW] }) ||
    can({ [RESOURCES.QUOTE_DEFAULTS]: [ACTIONS.VIEW] }) ||
    can({ [RESOURCES.QUOTE_STAGES]: [ACTIONS.VIEW] });
  const canViewPreferences = can({ [RESOURCES.CATALOG_PREFERENCES]: [ACTIONS.VIEW] });
  const canViewQuotePdfTemplate = can({ [RESOURCES.QUOTE_PDF_TEMPLATE]: [ACTIONS.VIEW] });

  const menuItems: SectionMenuItem[] = [
    { key: 'profile', label: t('profile.title'), group: t('groups.account') },
    { key: 'security', label: t('security.title'), group: t('groups.account') },
    ...(isSuperAdmin
      ? [{ key: 'permissions', label: t('permissions.title'), group: t('groups.access') }]
      : []),
    ...(canViewGeneral
      ? [{ key: 'general', label: t('general.title'), group: t('groups.system') }]
      : []),
    ...(canViewPreferences
      ? [{ key: 'preferences', label: t('preferences.title'), group: t('groups.system') }]
      : []),
    ...(canViewQuotePdfTemplate
      ? [
          {
            key: 'quotePdfTemplate',
            label: t('quotePdfTemplate.title'),
            group: t('groups.system'),
          },
        ]
      : []),
  ];

  if (!isDesktop) {
    return (
      <SettingsPageMobile
        menuItems={menuItems}
        isSuperAdmin={isSuperAdmin}
        section={mobileSection}
        onSelectSection={setMobileSection}
        onBack={() => setMobileSection(null)}
      />
    );
  }

  return (
    <SettingsPageDesktop
      menuItems={menuItems}
      isSuperAdmin={isSuperAdmin}
      section={section}
      onSelectSection={setSection}
    />
  );
}
