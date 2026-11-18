'use client';
import { Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { expiryStatus } from '@repo/guards';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { lastActiveDay } from '../helpers';

export function ExpiryTag({ expiresAt }: { expiresAt: string | null }) {
  const { t } = useTranslation('console');
  const { date } = useDateFormatter();
  const status = expiryStatus(expiresAt ? new Date(expiresAt) : null, new Date());

  switch (status.state) {
    case 'permanent':
      return <Typography.Text type="secondary">{t('expiry.permanent')}</Typography.Text>;
    case 'active':
      return <Typography.Text>{date(lastActiveDay(expiresAt)!)}</Typography.Text>;
    case 'expiringSoon':
      return <Tag color="warning">{t('expiry.expiringSoon', { count: status.daysLeft })}</Tag>;
    case 'expired':
      return <Tag color="error">{t('expiry.expired')}</Tag>;
  }
}
