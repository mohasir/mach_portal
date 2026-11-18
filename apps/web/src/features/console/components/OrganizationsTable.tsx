'use client';
import { useState } from 'react';
import { Segmented } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { CATALOG_KINDS, paginationOf, type CatalogKind } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import { CONSOLE_ROUTE } from '@/lib/auth/navigation';
import { useOrganizations } from '../hooks/useOrganizations';
import type { ConsoleOrganizationRow } from '../types';
import { OrganizationCard } from './OrganizationCard';
import { useOrganizationColumns } from './columns';

const ALL = 'all';
type KindFilter = CatalogKind | typeof ALL;

export function OrganizationsTable() {
  const { t } = useTranslation('console');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const [kind, setKind] = useState<KindFilter>(ALL);
  const catalogKind = kind === ALL ? undefined : kind;

  const table = useDataTable<'name' | 'createdAt'>({
    defaultSortBy: 'createdAt',
    externalFilters: { catalogKind },
  });
  const { data, isLoading } = useOrganizations({ ...table.query, catalogKind });

  const onView = (row: ConsoleOrganizationRow) =>
    router.push(`${CONSOLE_ROUTE}/organizations/${row.id}`);
  const columns = useOrganizationColumns({ onView });

  return (
    <div className="flex flex-col gap-4">
      <Segmented<KindFilter>
        aria-label={t('organizations.filterKind')}
        value={kind}
        onChange={setKind}
        options={[
          { value: ALL, label: t('organizations.filterAll') },
          ...CATALOG_KINDS.map((value) => ({ value, label: t(`vocabulary:${value}.Items`) })),
        ]}
        className="self-start"
      />
      <DataTable<ConsoleOrganizationRow>
        {...table.tableProps}
        rowKey="id"
        columns={columns}
        mobileRenderType="card"
        renderCard={(row) => <OrganizationCard row={row} onView={onView} />}
        onRow={(row) => ({ onClick: () => onView(row), className: 'cursor-pointer' })}
        dataSource={data?.items}
        loading={isLoading}
        total={paginationOf(data)?.total}
        searchPlaceholder={tc('table.search')}
        emptyText={t('organizations.empty')}
      />
    </div>
  );
}
