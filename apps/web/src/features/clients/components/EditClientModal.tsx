'use client';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateClientInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useUpdateClient } from '../hooks/useClients';
import { ClientForm } from './ClientForm';
import type { Client } from '../types';

interface EditClientModalProps {
  client: Client | null;
  open: boolean;
  onClose: () => void;
}

export function EditClientModal({ client, open, onClose }: EditClientModalProps) {
  const { t } = useTranslation('clients');
  const [form] = Form.useForm<CreateClientInput>();
  const { updateClient, isPending } = useUpdateClient(form);

  const onSubmit = async (values: CreateClientInput) => {
    if (!client) return;
    try {
      await updateClient(client.id, values);
      onClose();
    } catch {
      // error notificado por useApiError (toast genérico o form.setFields por campo)
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('edit.title')}>
      {client && (
        <ClientForm
          key={client.id}
          form={form}
          initialValues={{
            name: client.name,
            email: client.email ?? undefined,
            phone: client.phone ?? undefined,
            city: client.city ?? undefined,
            state: client.state ?? undefined,
            address: client.address ?? undefined,
            notes: client.notes ?? undefined,
          }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </WrapperModal>
  );
}
