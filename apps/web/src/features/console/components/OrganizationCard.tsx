'use client';
import { Card, Flex, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useOrganizationRowActions } from '../hooks/useOrganizationRowActions';
import type { ConsoleOrganizationRow } from '../types';
import { ExpiryTag } from './ExpiryTag';

export function OrganizationCard({
  row,
  onView,
}: {
  row: ConsoleOrganizationRow;
  onView: (row: ConsoleOrganizationRow) => void;
}) {
  const { t } = useTranslation('console');
  const { t: tc } = useTranslation('common');
  const rowActions = useOrganizationRowActions({ onView });

  return (
    <Card hoverable onClick={() => onView(row)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Typography.Text strong className="text-base">
            {row.name}
          </Typography.Text>
          <Typography.Text type="secondary" className="truncate text-sm">
            {row.slug}
          </Typography.Text>
        </div>
        <span onClick={(event) => event.stopPropagation()}>
          <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} />
        </span>
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <Tag>{t(`vocabulary:${row.catalogKind}.Items`)}</Tag>
        <Typography.Text type="secondary" className="text-sm">
          {t('organizations.card.features', { count: row.activeFeatureCount })}
        </Typography.Text>
        <ExpiryTag expiresAt={row.nextExpiry} />
      </Flex>
    </Card>
  );
}
