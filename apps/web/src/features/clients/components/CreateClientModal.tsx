'use client';
import { Form, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateClientInput } from '@repo/schemas';
import { useCreateClient } from '../hooks/useClients';
import { ClientForm } from './ClientForm';

interface CreateClientModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateClientModal({ open, onClose }: CreateClientModalProps) {
  const { t } = useTranslation('clients');
  const [form] = Form.useForm<CreateClientInput>();
  const { createClient, isPending } = useCreateClient(form);

  const onSubmit = async (values: CreateClientInput) => {
    try {
      await createClient(values);
      onClose();
    } catch {
      // error notificado por useApiError (toast genérico o form.setFields por campo)
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('create.title')}>
      {open && <ClientForm form={form} onSubmit={onSubmit} isPending={isPending} />}
    </Modal>
  );
}
