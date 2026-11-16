'use client';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UomDimension } from '@repo/schemas';
import { groupUnitsByDimension } from '../helpers';
import { useUnitOptions } from '../hooks/useUnitsOfMeasure';

interface SelectableUnit {
  id: string;
  name: string;
  code: string;
  dimension: UomDimension;
}

interface UnitSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  /** The unit the product has, offered even when it was deactivated afterwards. */
  current?: SelectableUnit;
  placeholder?: string;
}

/** Active units grouped by dimension; a controlled field for an AntD `Form.Item`. */
export function UnitSelect({ value, onChange, current, placeholder }: UnitSelectProps) {
  const { t } = useTranslation('unitsOfMeasure');
  const { data: units = [], isLoading } = useUnitOptions();

  const options = groupUnitsByDimension(units, current).map((group) => ({
    label: t(`dimensions.${group.dimension}`),
    title: t(`dimensions.${group.dimension}`),
    options: group.units.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.code})` })),
  }));

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      loading={isLoading}
      placeholder={placeholder}
      showSearch={{ optionFilterProp: 'label' }}
    />
  );
}
