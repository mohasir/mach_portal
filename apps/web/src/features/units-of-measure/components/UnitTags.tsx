'use client';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UnitOfMeasure } from '../types';

/** Status, system and base flags of a unit; shared by the table and the mobile card. */
export function UnitTags({ unit }: { unit: UnitOfMeasure }) {
  const { t } = useTranslation('unitsOfMeasure');
  return (
    <>
      <Tag color={unit.isActive ? 'green' : 'default'}>
        {unit.isActive ? t('status.active') : t('status.inactive')}
      </Tag>
      {unit.isSystem && <Tag color="blue">{t('tags.system')}</Tag>}
      {unit.isBase && <Tag>{t('tags.base')}</Tag>}
    </>
  );
}
