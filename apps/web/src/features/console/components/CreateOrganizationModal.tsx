'use client';
import { useState } from 'react';
import { Form } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { CreateOrganizationInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { CONSOLE_ROUTE } from '@/lib/auth/navigation';
import { useCreateOrganization } from '../hooks/useCreateOrganization';
import { OrganizationForm } from './OrganizationForm';
import { SetupLinkResult } from './SetupLinkResult';

interface Created {
  tenantId: string;
  name: string;
  setupUrl: string | null;
}

export function CreateOrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('console');
  const router = useRouter();
  const [form] = Form.useForm<CreateOrganizationInput>();
  const { createOrganization, isPending, reset } = useCreateOrganization(form);
  const [created, setCreated] = useState<Created | null>(null);

  const onSubmit = async (values: CreateOrganizationInput) => {
    try {
      const result = await createOrganization(values);
      setCreated({ tenantId: result.tenantId, name: values.name, setupUrl: result.setupUrl });
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal
      open={open}
      onCancel={onClose}
      afterClose={() => {
        setCreated(null);
        reset();
      }}
      title={created ? t('setup.title') : t('create.title')}
      maskClosable={!created}
    >
      {open &&
        (created ? (
          <SetupLinkResult
            name={created.name}
            setupUrl={created.setupUrl}
            onClose={onClose}
            onOpen={() => router.push(`${CONSOLE_ROUTE}/organizations/${created.tenantId}`)}
          />
        ) : (
          <OrganizationForm form={form} onSubmit={onSubmit} isPending={isPending} />
        ))}
    </WrapperModal>
  );
}
