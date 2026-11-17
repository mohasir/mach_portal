'use client';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ChargeType } from '../types';

/** Status of a charge type; shared by the table and the mobile card. */
export function ChargeTypeTags({ type }: { type: ChargeType }) {
  const { t } = useTranslation('chargeTypes');
  return (
    <Tag color={type.isActive ? 'green' : 'default'}>
      {type.isActive ? t('status.active') : t('status.inactive')}
    </Tag>
  );
}
