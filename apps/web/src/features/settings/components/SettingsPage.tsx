'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { SectionMenuItem } from '@/components/shared/SectionMenu';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useIsSuperAdmin } from '@/lib/auth/useIsSuperAdmin';
import { useCan } from '@/lib/auth/useCan';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { SettingsPageDesktop } from './SettingsPageDesktop';
import { SettingsPageMobile } from './SettingsPageMobile';

export type SettingsSection =
  | 'profile'
  | 'security'
  | 'general'
  | 'preferences'
  | 'quotePdfTemplate'
  | 'permissions'
  // Not a rendered section: selecting it navigates to /admin/settings/support
  // instead of setting state (it's its own routed page, not a form panel).
  | 'support'
  | 'about';
export type MobileSettingsSection = Exclude<SettingsSection, 'profile'> | 'profileEdit';

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const router = useRouter();
  const isSuperAdmin = useIsSuperAdmin();
  const can = useCan();
  const isDesktop = useIsDesktop();
  const [section, setSection] = useState<SettingsSection>('profile');
  const [mobileSection, setMobileSection] = useState<MobileSettingsSection | null>(null);
  const setFillViewport = useLayoutStore((s) => s.setFillViewport);

  const goToSupport = () => router.push('/admin/settings/support');
  const selectSection = (key: SettingsSection) =>
    key === 'support' ? goToSupport() : setSection(key);
  const selectMobileSection = (key: MobileSettingsSection) =>
    key === 'support' ? goToSupport() : setMobileSection(key);

  // The "about" section pins its copyright block to the bottom of the screen
  // (see AboutSettingsForm) instead of following normal document flow.
  useEffect(() => {
    setFillViewport(section === 'about' || mobileSection === 'about');
    return () => setFillViewport(false);
  }, [section, mobileSection, setFillViewport]);

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
    { key: 'support', label: t('support.title'), group: t('groups.about') },
    { key: 'about', label: t('about.title'), group: t('groups.about') },
  ];

  if (!isDesktop) {
    return (
      <SettingsPageMobile
        menuItems={menuItems}
        isSuperAdmin={isSuperAdmin}
        section={mobileSection}
        onSelectSection={selectMobileSection}
        onBack={() => setMobileSection(null)}
      />
    );
  }

  return (
    <SettingsPageDesktop
      menuItems={menuItems}
      isSuperAdmin={isSuperAdmin}
      section={section}
      onSelectSection={selectSection}
    />
  );
}
