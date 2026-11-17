'use client';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { blurActiveElementOnTouch } from '@/lib/utils/dom';
import {
  formatPlace,
  isLocationActive,
  levelTitle,
  locationOptions,
  type LocationSettings,
  type PlaceValue,
} from './helpers';
import { useLocalities } from './useLocalities';

export type { LocationSettings, PlaceValue } from './helpers';

interface LocationFieldsProps {
  settings: LocationSettings | null | undefined;
  value: PlaceValue;
  onChange: (place: PlaceValue) => void;
  readOnly?: boolean;
  /** Country the stored place was saved under; names it when the function is off. */
  storedCountry?: string | null;
}

/** Fragment of form items: place before and after it is the caller's grid. */
export function LocationFields({
  settings,
  value,
  onChange,
  readOnly,
  storedCountry,
}: LocationFieldsProps) {
  const { t } = useTranslation('common');
  const lang = useLocaleStore((s) => s.locale);
  const active = isLocationActive(settings);
  const country = active ? settings.country : null;
  const depth = active ? settings.depth : 0;
  const { localities, isLoading } = useLocalities(country, depth >= 2 ? value.region : null);

  // With the function off nothing is asked, but a stored place stays visible.
  if (!active) {
    const stored = formatPlace(storedCountry ?? settings?.country, value.region, value.locality);
    if (!stored) return null;
    return (
      <Form.Item label={<FieldLabel title={t('location.stored')} />}>
        <span>{stored}</span>
      </Form.Item>
    );
  }

  if (depth === 0) return null;

  const options = locationOptions(settings, value, localities);
  const regionTitle = levelTitle(settings.country, 1, lang);
  const localityTitle = levelTitle(settings.country, 2, lang);

  return (
    <>
      <Form.Item label={<FieldLabel title={regionTitle} required />} required>
        <Select
          showSearch={{ optionFilterProp: 'label' }}
          allowClear
          disabled={readOnly}
          value={value.region ?? undefined}
          placeholder={t('location.select', { level: regionTitle.toLowerCase() })}
          options={options.regions}
          onChange={(region?: string) => onChange({ region: region ?? null, locality: null })}
          onSelect={blurActiveElementOnTouch}
        />
      </Form.Item>
      {depth >= 2 && (
        <Form.Item label={<FieldLabel title={localityTitle} required />} required>
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            allowClear
            disabled={readOnly || !value.region}
            loading={isLoading}
            value={value.locality ?? undefined}
            placeholder={t('location.select', { level: localityTitle.toLowerCase() })}
            options={options.localities}
            onChange={(locality?: string) =>
              onChange({ region: value.region, locality: locality ?? null })
            }
            onSelect={blurActiveElementOnTouch}
          />
        </Form.Item>
      )}
    </>
  );
}
