'use client';
import { useState } from 'react';
import { App, Button, Form, Radio, Select, Skeleton, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { COUNTRIES, levelLabel, type CountryCode } from '@repo/geo';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import type { LocationSettings } from '@/components/shared/LocationFields/helpers';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useCan } from '@/lib/auth/useCan';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { useLocationSettings, useUpdateLocationSettings } from '../../hooks/useLocationSettings';
import {
  isLocationFormDirty,
  missingSettings,
  settingsPayload,
  toLocationForm,
  withCountry,
} from '../../locationHelpers';
import { LocationAreasPicker } from './LocationAreasPicker';

const COUNTRY_CODES = Object.keys(COUNTRIES) as CountryCode[];

export function LocationSettingsCard() {
  const { t } = useTranslation('settings');
  const can = useCan();
  const { data, isLoading, isError, refetch } = useLocationSettings();

  if (!can({ [RESOURCES.LOCATION_SETTINGS]: [ACTIONS.VIEW] })) return null;
  if (isError && !data) {
    return (
      <WrapperCard title={t('location.title')}>
        <WrapperAlert
          type="error"
          closeable={false}
          description={t('location.loadError')}
          actionText={t('location.retry')}
          onAction={() => void refetch()}
        />
      </WrapperCard>
    );
  }
  if (isLoading || !data) return <Skeleton active paragraph={{ rows: 3 }} />;

  return (
    <WrapperCard title={t('location.title')} caption={t('location.caption')}>
      {/* Keyed on the saved settings so the draft restarts from what the server stored. */}
      <LocationSettingsForm
        key={JSON.stringify(data)}
        saved={data}
        canEdit={can({ [RESOURCES.LOCATION_SETTINGS]: [ACTIONS.UPDATE] })}
      />
    </WrapperCard>
  );
}

function LocationSettingsForm({ saved, canEdit }: { saved: LocationSettings; canEdit: boolean }) {
  const { t } = useTranslation('settings');
  const lang = useLocaleStore((s) => s.locale);
  const { message } = App.useApp();
  const { updateLocationSettings, isPending } = useUpdateLocationSettings();
  const [draft, setDraft] = useState(() => toLocationForm(saved));
  const dirty = isLocationFormDirty(draft, saved);
  const { country } = draft;

  const save = async () => {
    const payload = settingsPayload(draft, saved);
    if (!payload) {
      const fields = missingSettings(draft).map((field) => t(`location.missing.${field}`));
      message.warning(t('location.incomplete', { fields: fields.join(', ') }));
      return;
    }
    try {
      await updateLocationSettings(payload);
      message.success(t('saveSuccess'));
    } catch {
      // The failure is already reported by useApiError.
    }
  };

  const level = (n: 1 | 2) => (country ? levelLabel(country, n, lang) : '');

  return (
    <Form layout="vertical" disabled={!canEdit} requiredMark={false}>
      <SwitchRow
        title={t('location.enable')}
        caption={
          draft.enabled && !saved.enabled
            ? `${t('location.enableCaption')} ${t('location.pendingHint')}`
            : t('location.enableCaption')
        }
        control={
          <Switch checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
        }
      />

      {draft.enabled && (
        <div className="mt-4 flex flex-col gap-1">
          <Form.Item label={<FieldLabel title={t('location.country')} required />}>
            <Select
              value={country ?? undefined}
              placeholder={t('location.countryPlaceholder')}
              options={COUNTRY_CODES.map((code) => ({
                value: code,
                label: t(`location.countries.${code}`),
              }))}
              onChange={(code: CountryCode) => setDraft(withCountry(draft, code))}
            />
          </Form.Item>

          {country && (
            <>
              <Form.Item
                label={
                  <FieldLabel
                    title={t('location.depth.title')}
                    caption={t('location.depth.caption')}
                    required
                  />
                }
              >
                <Radio.Group
                  className="flex flex-col gap-2"
                  value={draft.depth}
                  onChange={(e) => setDraft({ ...draft, depth: e.target.value })}
                >
                  <Radio value={0}>{t('location.depth.options.0')}</Radio>
                  <Radio value={1}>{t('location.depth.options.1', { level: level(1) })}</Radio>
                  <Radio value={2}>{t('location.depth.options.2', { level: level(2) })}</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                label={
                  <FieldLabel
                    title={t('location.scope.title')}
                    caption={t('location.scope.caption')}
                    required
                  />
                }
              >
                <Radio.Group
                  className="flex flex-col gap-2"
                  value={draft.scope}
                  onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
                >
                  <Radio value="country">{t('location.scope.country')}</Radio>
                  <Radio value="areas" disabled={draft.depth === 0}>
                    {t('location.scope.areas')}
                  </Radio>
                </Radio.Group>
              </Form.Item>

              {draft.scope === 'areas' && (
                <Form.Item label={<FieldLabel title={t('location.areas.title')} required />}>
                  <LocationAreasPicker
                    country={country}
                    depth={draft.depth}
                    areas={draft.areas}
                    onChange={(areas) => setDraft({ ...draft, areas })}
                    readOnly={!canEdit}
                  />
                </Form.Item>
              )}

              <SwitchRow
                title={t('location.askAddress.title')}
                caption={t('location.askAddress.caption')}
                control={
                  <Switch
                    checked={draft.askAddress}
                    onChange={(askAddress) => setDraft({ ...draft, askAddress })}
                  />
                }
              />
            </>
          )}
        </div>
      )}

      {canEdit && (
        <Button
          type="primary"
          loading={isPending}
          disabled={!dirty}
          onClick={() => void save()}
          className="mt-6"
        >
          {t('save')}
        </Button>
      )}
    </Form>
  );
}
