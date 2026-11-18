'use client';
import { useState } from 'react';
import { Button, Typography } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CreateOrganizationModal } from './CreateOrganizationModal';
import { OrganizationsTable } from './OrganizationsTable';

// The console has no topbar, so the shared PageHeader (which hands its mobile title to it)
// would render nothing on small screens.
export function OrganizationsPage() {
  const { t } = useTranslation('console');
  const [isCreateOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Typography.Title level={3} className="font-heading m-0">
          {t('organizations.title')}
        </Typography.Title>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => setCreateOpen(true)}
          className="w-full sm:w-auto"
        >
          {t('organizations.add')}
        </Button>
      </div>
      <OrganizationsTable />
      <CreateOrganizationModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
