'use client';
import { useState } from 'react';
import { Button, Select, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CountryCode } from '@repo/geo';
import type { LocationArea, LocationDepth } from '@repo/schemas';
import { levelTitle, regionOptions } from '@/components/shared/LocationFields/helpers';
import { useLocalities } from '@/components/shared/LocationFields/useLocalities';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { addArea, areaLabel, removeArea } from '../../locationHelpers';

interface LocationAreasPickerProps {
  country: CountryCode;
  depth: LocationDepth | null;
  areas: LocationArea[];
  onChange: (areas: LocationArea[]) => void;
  readOnly?: boolean;
}

export function LocationAreasPicker({
  country,
  depth,
  areas,
  onChange,
  readOnly,
}: LocationAreasPickerProps) {
  const { t } = useTranslation('settings');
  const lang = useLocaleStore((s) => s.locale);
  const [region, setRegion] = useState<string | null>(null);
  const [locality, setLocality] = useState<string | null>(null);
  const canPickLocality = depth === 2;
  const { localities, isLoading } = useLocalities(country, canPickLocality ? region : null);
  const regionTitle = levelTitle(country, 1, lang);

  const add = () => {
    if (!region) return;
    onChange(addArea(areas, { region, locality }));
    setRegion(null);
    setLocality(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select
          className="w-full sm:flex-1"
          showSearch={{ optionFilterProp: 'label' }}
          allowClear
          value={region ?? undefined}
          placeholder={t('location.areas.regionPlaceholder', { level: regionTitle.toLowerCase() })}
          options={regionOptions(country)}
          onChange={(value?: string) => {
            setRegion(value ?? null);
            setLocality(null);
          }}
        />
        {canPickLocality && (
          <Select
            className="w-full sm:flex-1"
            showSearch={{ optionFilterProp: 'label' }}
            allowClear
            disabled={!region}
            loading={isLoading}
            value={locality ?? undefined}
            placeholder={t('location.areas.localityPlaceholder')}
            options={localities.map((name) => ({ value: name, label: name }))}
            onChange={(value?: string) => setLocality(value ?? null)}
          />
        )}
        <Button onClick={add} disabled={!region}>
          {t('location.areas.add')}
        </Button>
      </div>
      {areas.length === 0 ? (
        <span className="text-gray-500 text-xs">{t('location.areas.empty')}</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {areas.map((area) => (
            <Tag
              key={`${area.region}/${area.locality ?? ''}`}
              closable={!readOnly}
              onClose={() => onChange(removeArea(areas, area))}
              className="m-0"
            >
              {areaLabel(country, area)}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}
